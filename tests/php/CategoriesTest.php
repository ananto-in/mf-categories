<?php

declare(strict_types=1);

namespace Ananto\MfCategories\Tests;

use Ananto\MfCategories\Categories;
use Ananto\MfCategories\Category;
use DateTimeImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class CategoriesTest extends TestCase
{
    private const DATA_DIR = __DIR__ . '/../../data';

    private Categories $categories;

    protected function setUp(): void
    {
        $this->categories = new Categories();
    }

    /** @return array<mixed> */
    private function dataFile(string $name): array
    {
        $raw = (string) file_get_contents(self::DATA_DIR . "/{$name}.json");

        return json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    }

    /**
     * @param list<Category> $list
     * @return list<string>
     */
    private function ids(array $list): array
    {
        return array_map(static fn (Category $c): string => $c->id, $list);
    }

    // ---- all / find -------------------------------------------------------

    public function testAllReturnsEveryCategoryInFileOrder(): void
    {
        $expected = array_column($this->dataFile('categories')['categories'], 'id');

        $all = $this->categories->all();

        $this->assertContainsOnlyInstancesOf(Category::class, $all);
        $this->assertSame($expected, $this->ids($all));
    }

    public function testFindReturnsCategoryWithCamelCaseProperties(): void
    {
        $category = $this->categories->find('debt.short_term');

        $this->assertInstanceOf(Category::class, $category);
        $this->assertSame('debt.short_term', $category->id);
        $this->assertSame('debt', $category->parent);
        $this->assertSame('specific', $category->level);
        $this->assertSame('Short Term Fund', $category->name);
        $this->assertSame('active', $category->status);
        $this->assertSame('2017-10-06', $category->validFrom);
        $this->assertNull($category->validTo);
        $this->assertSame('sebi-2026-02-26', $category->circular);
        $this->assertSame(['Short Duration Fund'], $category->formerNames);
        $this->assertSame(['min' => 1, 'max' => 3], $category->characteristics['macaulay_duration_years']);
        $this->assertStringContainsString('between 1 year to 3 years', (string) $category->schemeTypeDescription);
    }

    public function testFindReturnsNullForUnknownId(): void
    {
        $this->assertNull($this->categories->find('debt.nope'));
    }

    public function testBroadCategoryCarriesClassificationDescription(): void
    {
        $this->assertSame(
            'Mutual Fund scheme predominantly investing in equity and equity related instruments',
            $this->categories->find('equity')?->description
        );
    }

    public function testSubCategoryHasGroup(): void
    {
        $category = $this->categories->find('other.fof.commodity_based');

        $this->assertSame('sub', $category?->level);
        $this->assertSame('Commodity based FoF (Domestic)', $category?->group);
    }

    public function testOptionalFieldsDefaultToEmpty(): void
    {
        $category = $this->categories->find('equity');

        $this->assertSame('Equity', $category?->shortName);
        $this->assertNull($this->categories->find('other.fof.commodity_based')?->shortName);
        $this->assertNull($category?->group);
        $this->assertSame([], $category?->formerNames);
        $this->assertSame([], $category?->characteristics);
    }

    // ---- children ---------------------------------------------------------

    public function testChildrenOfBroadCategoryAreItsSpecificCategories(): void
    {
        $children = $this->categories->children('equity');

        $this->assertCount(15, $children);
        $this->assertContains('equity.large_cap', $this->ids($children));
        $this->assertContains('equity.sectoral_thematic', $this->ids($children));
    }

    public function testChildrenOfFofAreItsSeventeenSubCategories(): void
    {
        $this->assertCount(17, $this->categories->children('other.fof'));
    }

    public function testChildrenOfLeafOrUnknownIsEmpty(): void
    {
        $this->assertSame([], $this->categories->children('debt.short_term'));
        $this->assertSame([], $this->categories->children('nope'));
    }

    // ---- active -----------------------------------------------------------

    public function testActiveDefaultsToToday(): void
    {
        $active = $this->ids($this->categories->active());

        $this->assertContains('equity.sectoral', $active);
        $this->assertNotContains('equity.sectoral_thematic', $active);
        $this->assertNotContains('solution_oriented.retirement', $active);
    }

    public function testActiveBeforeTheFebruary2026Circular(): void
    {
        $active = $this->ids($this->categories->active('2026-02-25'));

        $this->assertContains('equity.sectoral_thematic', $active);
        $this->assertContains('equity.value_contra', $active);
        $this->assertContains('solution_oriented.retirement', $active);
        $this->assertNotContains('equity.sectoral', $active);
        $this->assertNotContains('life_cycle', $active);
        $this->assertNotContains('debt.sectoral', $active);
    }

    public function testActiveOnTheEffectiveDateSwitchesToTheNewFramework(): void
    {
        $active = $this->ids($this->categories->active(new DateTimeImmutable('2026-02-26')));

        $this->assertContains('equity.sectoral', $active);
        $this->assertContains('life_cycle.maturity_5y', $active);
        $this->assertNotContains('equity.sectoral_thematic', $active);
        $this->assertNotContains('solution_oriented', $active);
    }

    public function testActiveBeforeFlexiCapWasIntroduced(): void
    {
        $this->assertNotContains('equity.flexi_cap', $this->ids($this->categories->active('2020-11-05')));
        $this->assertContains('equity.flexi_cap', $this->ids($this->categories->active('2020-11-06')));
    }

    public function testActiveBeforeTheFofFrameworkExcludesItsSubCategories(): void
    {
        $this->assertNotContains('other.fof.hybrid_aggressive', $this->ids($this->categories->active('2025-06-29')));
        $this->assertContains('other.fof.hybrid_aggressive', $this->ids($this->categories->active('2025-06-30')));
    }

    public function testActiveRejectsAMalformedDate(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->categories->active('26/02/2026');
    }

    public function testIsActiveOnMatchesTheValidityWindow(): void
    {
        $retirement = $this->categories->find('solution_oriented.retirement');

        $this->assertTrue($retirement?->isActiveOn('2026-02-25'));
        $this->assertFalse($retirement?->isActiveOn('2026-02-26'));
    }

    // ---- labels -----------------------------------------------------------

    /** @return array<string, array{string, string}> */
    public static function labelProvider(): array
    {
        return [
            'current debt' => ['Income/Debt Oriented Schemes - Short Term Fund', 'debt.short_term'],
            'current equity' => ['Equity Schemes - Thematic Fund', 'equity.thematic'],
            'current debt sectoral' => ['Income/Debt Oriented Schemes - Sectoral Fund', 'debt.sectoral'],
            'hyphen inside the name' => ['Equity Schemes - ELSS- Tax Saver Fund', 'equity.elss'],
            'recent pre-2026' => ['Debt Scheme - Low Duration Fund', 'debt.ultra_short_to_short_term'],
            'life cycle' => ['Life Cycle Funds - Life Cycle Fund with Maturity of 30 Years', 'life_cycle.maturity_30y'],
            'discontinued' => ['Solution Oriented Schemes ** - Retirement Fund', 'solution_oriented.retirement'],
            'repeated spaces' => ['Other Scheme -  Other   ETFs', 'other.index_funds_etfs'],
            'surrounding space' => ['  Equity Schemes - Contra Fund  ', 'equity.contra'],
            'different case' => ['equity schemes - value fund', 'equity.value'],
        ];
    }

    #[DataProvider('labelProvider')]
    public function testResolveLabel(string $label, string $expectedId): void
    {
        $this->assertSame($expectedId, $this->categories->resolveLabel($label)?->id);
    }

    public function testResolveLabelIsNullForUnknownLabels(): void
    {
        $this->assertNull($this->categories->resolveLabel('Close Ended - Something Else'));
        $this->assertNull($this->categories->resolveLabel('Income'));
        $this->assertNull($this->categories->resolveLabel(''));
    }

    public function testResolveLabelIsNullWhenTheLabelIsAmbiguous(): void
    {
        $this->assertNull($this->categories->resolveLabel('Equity Scheme - Sectoral/ Thematic'));
    }

    public function testCandidatesForLabelListsEveryPossibility(): void
    {
        $this->assertSame(
            ['equity.sectoral', 'equity.thematic'],
            $this->ids($this->categories->candidatesForLabel('Equity Scheme - Sectoral/ Thematic'))
        );
        $this->assertSame(
            ['equity.value'],
            $this->ids($this->categories->candidatesForLabel('Equity Schemes - Value Fund'))
        );
        $this->assertSame([], $this->categories->candidatesForLabel('Nothing'));
    }

    public function testEveryAliasInTheDatasetResolvesToExistingCategories(): void
    {
        foreach ($this->dataFile('aliases')['aliases'] as $alias) {
            $candidates = $this->categories->candidatesForLabel($alias['label']);

            $this->assertNotSame([], $candidates, $alias['label']);
            $this->assertSame(
                count($alias['candidates'] ?? [$alias['category']]),
                count($candidates),
                $alias['label']
            );
        }
    }

    // ---- history ----------------------------------------------------------

    public function testSuccessorsOfASplitAreTheNewCategories(): void
    {
        $this->assertSame(
            ['equity.sectoral', 'equity.thematic'],
            $this->ids($this->categories->successors('equity.sectoral_thematic'))
        );
        $this->assertSame(
            ['equity.value', 'equity.contra'],
            $this->ids($this->categories->successors('equity.value_contra'))
        );
    }

    public function testSuccessorsIsEmptyForRenamedDiscontinuedAndUnknownCategories(): void
    {
        // a rename keeps the same id, so there is no successor
        $this->assertSame([], $this->categories->successors('debt.short_term'));
        $this->assertSame([], $this->categories->successors('solution_oriented.retirement'));
        $this->assertSame([], $this->categories->successors('nope'));
    }

    public function testHistoryForACategoryIncludesRenamesAndSplits(): void
    {
        $types = array_column($this->categories->history('debt.short_term'), 'type');
        $this->assertSame(['rename'], $types);

        $types = array_column($this->categories->history('equity.sectoral'), 'type');
        $this->assertSame(['split'], $types);
    }

    public function testHistoryWithoutAnIdReturnsEveryEvent(): void
    {
        $this->assertCount(count($this->dataFile('history')['events']), $this->categories->history());
        $this->assertSame([], $this->categories->history('nope'));
    }

    // ---- rules, glide paths, circulars, meta ------------------------------

    public function testRulesForIncludesRulesOnTheCategoryAndItsAncestors(): void
    {
        $ids = array_column($this->categories->rulesFor('equity.sectoral'), 'id');

        $this->assertContains('sectoral_thematic_overlap', $ids); // directly on the category
        $this->assertContains('overlap_disclosure', $ids);        // on the broad category equity
        $this->assertContains('scheme_naming', $ids);
        $this->assertNotContains('life_cycle_exit_load', $ids);
    }

    public function testRulesForASubCategoryIncludesItsParents(): void
    {
        $ids = array_column($this->categories->rulesFor('other.fof.commodity_based'), 'id');

        $this->assertContains('fof_scheme_limits', $ids);          // directly
        $this->assertContains('fof_multi_underlying_framework', $ids); // via other.fof
    }

    public function testRulesForUnknownCategoryIsEmpty(): void
    {
        $this->assertSame([], $this->categories->rulesFor('nope'));
    }

    public function testGlidePath(): void
    {
        $glide = $this->categories->glidePath('life_cycle.maturity_5y');

        $this->assertCount(3, $glide['bands']);
        $this->assertSame(['min' => 35, 'max' => 50], $glide['bands'][0]['equity_pct']);
        $this->assertNull($this->categories->glidePath('equity.large_cap'));
    }

    public function testCircularAndMeta(): void
    {
        $this->assertSame(
            'HO/24/13/15(2)2026-IMD-RAC4/I/5764/2026',
            $this->categories->circular('sebi-2026-02-26')['number']
        );
        $this->assertNull($this->categories->circular('nope'));
        $this->assertSame($this->dataFile('meta')['dataset_version'], $this->categories->meta()['dataset_version']);
    }

    // ---- loading ----------------------------------------------------------

    public function testMissingDataDirectoryThrows(): void
    {
        $categories = new Categories(self::DATA_DIR . '/does-not-exist');

        $this->expectException(RuntimeException::class);

        $categories->all();
    }

    public function testInvalidJsonThrows(): void
    {
        $dir = sys_get_temp_dir() . '/mf-categories-' . bin2hex(random_bytes(4));
        mkdir($dir);
        file_put_contents($dir . '/categories.json', '{ not json');

        try {
            $this->expectException(RuntimeException::class);
            (new Categories($dir))->all();
        } finally {
            unlink($dir . '/categories.json');
            rmdir($dir);
        }
    }

    public function testFilesAreOnlyReadWhenNeeded(): void
    {
        $dir = sys_get_temp_dir() . '/mf-categories-' . bin2hex(random_bytes(4));
        mkdir($dir);
        copy(self::DATA_DIR . '/categories.json', $dir . '/categories.json');

        try {
            // aliases.json is absent: find() must not need it
            $this->assertSame('Equity Schemes', (new Categories($dir))->find('equity')?->name);
        } finally {
            unlink($dir . '/categories.json');
            rmdir($dir);
        }
    }

    public function testInstancesShareTheParsedDataWithinAProcess(): void
    {
        $first = new Categories();
        $second = new Categories();

        $this->assertSame($first->find('equity'), $second->find('equity'));
    }
}
