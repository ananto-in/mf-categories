<?php

declare(strict_types=1);

namespace Ananto\MfCategories;

use DateTimeImmutable;
use DateTimeInterface;
use JsonException;
use RuntimeException;

/**
 * Read-only access to the mf-categories dataset.
 *
 * Each JSON file is read and indexed on first use, then cached for the rest of the process,
 * so a request that only calls find() never touches aliases.json, rules.json and the like.
 * Categories are typed objects; rules, history, glide paths, circulars and meta are returned
 * as the plain arrays found in the JSON files (snake_case keys).
 */
final class Categories
{
    /** @var array<string, mixed> parsed files and indexes, shared by every instance in the process */
    private static array $cache = [];

    private readonly string $dataDir;

    public function __construct(?string $dataDir = null)
    {
        $this->dataDir = rtrim($dataDir ?? __DIR__ . '/../../data', '/\\');
    }

    /**
     * Every category, including superseded and discontinued ones, in file order.
     *
     * @return list<Category>
     */
    public function all(): array
    {
        return $this->categoryIndex()['list'];
    }

    public function find(string $id): ?Category
    {
        return $this->categoryIndex()['byId'][$id] ?? null;
    }

    /**
     * Direct children only (broad -> specific, specific -> sub).
     *
     * @return list<Category>
     */
    public function children(string $id): array
    {
        return $this->categoryIndex()['children'][$id] ?? [];
    }

    /**
     * Categories in force on a date (today by default).
     *
     * @return list<Category>
     */
    public function active(DateTimeInterface|string|null $on = null): array
    {
        $day = Category::toDay($on ?? new DateTimeImmutable('today'));

        return array_values(array_filter(
            $this->all(),
            static fn (Category $category): bool => $category->isActiveOn($day)
        ));
    }

    /**
     * The category an AMFI scheme-data label maps to, or null when the label is unknown or ambiguous.
     * Matching ignores case and repeated or surrounding whitespace.
     */
    public function resolveLabel(string $label): ?Category
    {
        $candidates = $this->candidatesForLabel($label);

        return count($candidates) === 1 ? $candidates[0] : null;
    }

    /**
     * Every category a label can mean: one for a clear label, several for an ambiguous one
     * (for example the old "Sectoral/ Thematic"), none for an unknown one.
     *
     * @return list<Category>
     */
    public function candidatesForLabel(string $label): array
    {
        $ids = $this->aliasIndex()[self::normalizeLabel($label)] ?? [];

        return array_values(array_filter(array_map($this->find(...), $ids)));
    }

    /**
     * Categories that continue a split, merged or replaced category. A rename keeps the same id,
     * so renamed and discontinued categories have no successors.
     *
     * @return list<Category>
     */
    public function successors(string $id): array
    {
        $ids = [];
        foreach ($this->read('history')['events'] as $event) {
            if (in_array($event['type'], ['split', 'merge', 'replace'], true) && in_array($id, $event['from'], true)) {
                array_push($ids, ...$event['to']);
            }
        }

        return array_values(array_filter(array_map(
            $this->find(...),
            array_values(array_unique(array_diff($ids, [$id])))
        )));
    }

    /**
     * Lifecycle events that name the category, or every event when no id is given.
     *
     * @return list<array<string, mixed>>
     */
    public function history(?string $id = null): array
    {
        $events = $this->read('history')['events'];
        if ($id === null) {
            return $events;
        }

        return array_values(array_filter(
            $events,
            static fn (array $event): bool => in_array($id, $event['from'], true) || in_array($id, $event['to'], true)
        ));
    }

    /**
     * Rules that apply to the category directly or through one of its parents.
     *
     * @return list<array<string, mixed>>
     */
    public function rulesFor(string $id): array
    {
        $chain = [];
        for ($current = $this->find($id); $current !== null; $current = $this->find($current->parent ?? '')) {
            $chain[] = $current->id;
        }

        return array_values(array_filter(
            $this->read('rules')['rules'],
            static fn (array $rule): bool => array_intersect($chain, $rule['applies_to']) !== []
        ));
    }

    /**
     * @return array<string, mixed>|null
     */
    public function glidePath(string $id): ?array
    {
        foreach ($this->read('glide-paths')['glide_paths'] as $glidePath) {
            if ($glidePath['category'] === $id) {
                return $glidePath;
            }
        }

        return null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function circular(string $id): ?array
    {
        foreach ($this->read('circulars')['circulars'] as $circular) {
            if ($circular['id'] === $id) {
                return $circular;
            }
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    public function meta(): array
    {
        return $this->read('meta');
    }

    /**
     * @return array{list: list<Category>, byId: array<string, Category>, children: array<string, list<Category>>}
     */
    private function categoryIndex(): array
    {
        return self::$cache[$this->dataDir . '|index:categories'] ??= $this->buildCategoryIndex();
    }

    /**
     * @return array{list: list<Category>, byId: array<string, Category>, children: array<string, list<Category>>}
     */
    private function buildCategoryIndex(): array
    {
        $list = array_map(Category::fromArray(...), $this->read('categories')['categories']);
        $byId = [];
        $children = [];
        foreach ($list as $category) {
            $byId[$category->id] = $category;
            if ($category->parent !== null) {
                $children[$category->parent][] = $category;
            }
        }

        return ['list' => $list, 'byId' => $byId, 'children' => $children];
    }

    /**
     * @return array<string, list<string>> normalised label => category ids
     */
    private function aliasIndex(): array
    {
        return self::$cache[$this->dataDir . '|index:aliases'] ??= $this->buildAliasIndex();
    }

    /**
     * @return array<string, list<string>>
     */
    private function buildAliasIndex(): array
    {
        $index = [];
        foreach ($this->read('aliases')['aliases'] as $alias) {
            $index[self::normalizeLabel($alias['label'])] = $alias['candidates'] ?? [$alias['category']];
        }

        return $index;
    }

    private static function normalizeLabel(string $label): string
    {
        $spaced = str_replace("\xC2\xA0", ' ', $label);

        return strtolower(trim((string) preg_replace('/\s+/', ' ', $spaced)));
    }

    /**
     * @return array<string, mixed>
     */
    private function read(string $name): array
    {
        return self::$cache[$this->dataDir . '|file:' . $name] ??= $this->decode($name);
    }

    /**
     * @return array<string, mixed>
     */
    private function decode(string $name): array
    {
        $path = "{$this->dataDir}/{$name}.json";
        $raw = is_file($path) ? file_get_contents($path) : false;
        if ($raw === false) {
            throw new RuntimeException("mf-categories data file not found: {$path}");
        }

        try {
            return json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new RuntimeException("mf-categories data file is not valid JSON: {$path}", 0, $e);
        }
    }
}
