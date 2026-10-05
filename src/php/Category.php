<?php

declare(strict_types=1);

namespace Ananto\MfCategories;

use DateTimeInterface;
use InvalidArgumentException;

/**
 * One category (broad, specific or sub) from data/categories.json. Immutable.
 *
 * Dates are 'YYYY-MM-DD' strings. A category is in force on a date when
 * validFrom <= date and (validTo is null or date < validTo).
 */
final class Category
{
    /**
     * @param array<string, mixed> $characteristics
     * @param list<string> $formerNames
     */
    public function __construct(
        public readonly string $id,
        public readonly ?string $parent,
        public readonly string $level,
        public readonly string $name,
        public readonly string $status,
        public readonly ?string $validFrom,
        public readonly ?string $validTo,
        public readonly ?string $circular,
        public readonly ?string $shortName = null,
        public readonly ?string $group = null,
        public readonly ?string $schemeTypeDescription = null,
        public readonly ?string $description = null,
        public readonly array $characteristics = [],
        public readonly array $formerNames = [],
        public readonly ?string $note = null,
    ) {
    }

    /**
     * @param array<string, mixed> $row one entry of categories.json
     */
    public static function fromArray(array $row): self
    {
        return new self(
            id: $row['id'],
            parent: $row['parent'],
            level: $row['level'],
            name: $row['name'],
            status: $row['status'],
            validFrom: $row['valid_from'],
            validTo: $row['valid_to'],
            circular: $row['circular'],
            shortName: $row['short_name'] ?? null,
            group: $row['group'] ?? null,
            schemeTypeDescription: $row['scheme_type_description'] ?? null,
            description: $row['description'] ?? null,
            characteristics: $row['characteristics'] ?? [],
            formerNames: $row['former_names'] ?? [],
            note: $row['note'] ?? null,
        );
    }

    public function isActiveOn(DateTimeInterface|string $date): bool
    {
        $day = self::toDay($date);

        return ($this->validFrom === null || $this->validFrom <= $day)
            && ($this->validTo === null || $day < $this->validTo);
    }

    /**
     * @internal
     */
    public static function toDay(DateTimeInterface|string $date): string
    {
        if ($date instanceof DateTimeInterface) {
            return $date->format('Y-m-d');
        }

        if (
            preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $date, $m) !== 1
            || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])
        ) {
            throw new InvalidArgumentException("Expected a date as YYYY-MM-DD, got \"{$date}\"");
        }

        return $date;
    }
}
