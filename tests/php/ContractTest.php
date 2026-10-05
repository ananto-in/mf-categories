<?php

declare(strict_types=1);

namespace Ananto\MfCategories\Tests;

use Ananto\MfCategories\Categories;
use Ananto\MfCategories\Category;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Runs the cases in tests/contract/api-contract.json, which tests/js/contract.test.js runs too,
 * so the PHP and JS packages are held to identical behaviour.
 */
final class ContractTest extends TestCase
{
    private Categories $categories;

    protected function setUp(): void
    {
        $this->categories = new Categories();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function cases(string $section): array
    {
        $raw = (string) file_get_contents(__DIR__ . '/../contract/api-contract.json');
        $contract = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);

        return $contract[$section];
    }

    /**
     * @return array<string, array{array<string, mixed>}>
     */
    private static function provide(string $section, string $key): array
    {
        $cases = [];
        foreach (self::cases($section) as $i => $case) {
            $cases["{$section} #{$i} " . json_encode($case[$key] ?? '')] = [$case];
        }

        return $cases;
    }

    /**
     * @param list<Category> $list
     * @return list<string>
     */
    private function ids(array $list): array
    {
        return array_map(static fn (Category $c): string => $c->id, $list);
    }

    /** @return array<string, array{array<string, mixed>}> */
    public static function findCases(): array
    {
        return self::provide('find', 'id');
    }

    /** @param array<string, mixed> $case */
    #[DataProvider('findCases')]
    public function testFind(array $case): void
    {
        $category = $this->categories->find($case['id']);

        $this->assertSame($case['name'], $category?->name);
        if ($case['name'] !== null) {
            $this->assertSame($case['parent'], $category->parent);
            $this->assertSame($case['level'], $category->level);
            $this->assertSame($case['status'], $category->status);
        }
    }

    /** @return array<string, array{array<string, mixed>}> */
    public static function childrenCases(): array
    {
        return self::provide('children', 'id');
    }

    /** @param array<string, mixed> $case */
    #[DataProvider('childrenCases')]
    public function testChildren(array $case): void
    {
        $ids = $this->ids($this->categories->children($case['id']));

        $this->assertCount($case['count'], $ids);
        foreach ($case['includes'] ?? [] as $id) {
            $this->assertContains($id, $ids);
        }
    }

    /** @return array<string, array{array<string, mixed>}> */
    public static function isActiveOnCases(): array
    {
        return self::provide('isActiveOn', 'id');
    }

    /** @param array<string, mixed> $case */
    #[DataProvider('isActiveOnCases')]
    public function testIsActiveOn(array $case): void
    {
        $this->assertSame($case['active'], $this->categories->find($case['id'])?->isActiveOn($case['on']));
    }

    /** @return array<string, array{array<string, mixed>}> */
    public static function activeCases(): array
    {
        return self::provide('active', 'on');
    }

    /** @param array<string, mixed> $case */
    #[DataProvider('activeCases')]
    public function testActive(array $case): void
    {
        $ids = $this->ids($this->categories->active($case['on']));

        foreach ($case['includes'] as $id) {
            $this->assertContains($id, $ids);
        }
        foreach ($case['excludes'] as $id) {
            $this->assertNotContains($id, $ids);
        }
    }

    /** @return array<string, array{string}> */
    public static function invalidDates(): array
    {
        $dates = [];
        foreach (self::cases('invalidDates') as $i => $date) {
            $dates["invalid #{$i} " . json_encode($date)] = [$date];
        }

        return $dates;
    }

    #[DataProvider('invalidDates')]
    public function testActiveRejectsInvalidDates(string $date): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->categories->active($date);
    }

    /** @return array<string, array{array<string, mixed>}> */
    public static function resolveLabelCases(): array
    {
        return self::provide('resolveLabel', 'label');
    }

    /** @param array<string, mixed> $case */
    #[DataProvider('resolveLabelCases')]
    public function testResolveLabel(array $case): void
    {
        $this->assertSame($case['id'], $this->categories->resolveLabel($case['label'])?->id);
    }

    /** @return array<string, array{array<string, mixed>}> */
    public static function candidatesCases(): array
    {
        return self::provide('candidatesForLabel', 'label');
    }

    /** @param array<string, mixed> $case */
    #[DataProvider('candidatesCases')]
    public function testCandidatesForLabel(array $case): void
    {
        $this->assertSame($case['ids'], $this->ids($this->categories->candidatesForLabel($case['label'])));
    }

    /** @return array<string, array{array<string, mixed>}> */
    public static function successorCases(): array
    {
        return self::provide('successors', 'id');
    }

    /** @param array<string, mixed> $case */
    #[DataProvider('successorCases')]
    public function testSuccessors(array $case): void
    {
        $this->assertSame($case['ids'], $this->ids($this->categories->successors($case['id'])));
    }

    /** @return array<string, array{array<string, mixed>}> */
    public static function historyCases(): array
    {
        return self::provide('history', 'id');
    }

    /** @param array<string, mixed> $case */
    #[DataProvider('historyCases')]
    public function testHistory(array $case): void
    {
        $this->assertSame($case['types'], array_column($this->categories->history($case['id']), 'type'));
    }

    /** @return array<string, array{array<string, mixed>}> */
    public static function rulesForCases(): array
    {
        return self::provide('rulesFor', 'id');
    }

    /** @param array<string, mixed> $case */
    #[DataProvider('rulesForCases')]
    public function testRulesFor(array $case): void
    {
        $ids = array_column($this->categories->rulesFor($case['id']), 'id');

        foreach ($case['includes'] as $id) {
            $this->assertContains($id, $ids);
        }
        foreach ($case['excludes'] as $id) {
            $this->assertNotContains($id, $ids);
        }
        if ($case['includes'] === [] && $case['excludes'] === []) {
            $this->assertSame([], $ids);
        }
    }

    /** @return array<string, array{array<string, mixed>}> */
    public static function glidePathCases(): array
    {
        return self::provide('glidePath', 'id');
    }

    /** @param array<string, mixed> $case */
    #[DataProvider('glidePathCases')]
    public function testGlidePath(array $case): void
    {
        $glidePath = $this->categories->glidePath($case['id']);

        $this->assertSame($case['bands'], $glidePath === null ? null : count($glidePath['bands']));
    }

    /** @return array<string, array{array<string, mixed>}> */
    public static function circularCases(): array
    {
        return self::provide('circular', 'id');
    }

    /** @param array<string, mixed> $case */
    #[DataProvider('circularCases')]
    public function testCircular(array $case): void
    {
        $this->assertSame($case['number'], $this->categories->circular($case['id'])['number'] ?? null);
    }
}
