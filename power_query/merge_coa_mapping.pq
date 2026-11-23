// ============================================================================
// Savanna Pay Ltd — Power Query M Script: COA Mapping Merge & Unmapped Check
// File: power_query/merge_coa_mapping.pq
// Depends On: transform_trial_balance (TB_Clean_Base), savanna_pay_coa_mapping.csv (BS_Map)
// ============================================================================

let
    // 1. Reference cleaned Trial Balance rows and governed COA Mapping table
    SourceTB = transform_trial_balance,
    SourceCOARaw = Csv.Document(
        File.Contents("C:\FP&A\SavannaPay\data\savanna_pay_coa_mapping.csv"),
        [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]
    ),
    BS_Map = Table.TransformColumnTypes(
        Table.PromoteHeaders(SourceCOARaw, [PromoteAllScalars = true]),
        {
            {"AccountCode", type text},
            {"AccountName", type text},
            {"BS_Group", type text},
            {"BS_Section", type text},
            {"BS_LineItem", type text},
            {"NormalBalance", type text},
            {"PresentationSign", Int64.Type}
        }
    ),

    // 2. Left Outer Join so unmapped GL accounts surface immediately instead of dropping silently
    MergedCOA = Table.NestedJoin(
        SourceTB,
        {"AccountCode"},
        BS_Map,
        {"AccountCode"},
        "COA_Match",
        JoinKind.LeftOuter
    ),
    ExpandedCOA = Table.ExpandTableColumn(
        MergedCOA,
        "COA_Match",
        {"BS_Group", "BS_Section", "BS_LineItem", "NormalBalance", "PresentationSign"},
        {"BS_Group", "BS_Section", "BS_LineItem", "NormalBalance", "PresentationSign"}
    ),

    // 3. Flag unmapped accounts for month-end close governance
    FlaggedUnmapped = Table.AddColumn(
        ExpandedCOA,
        "MappingStatus",
        each if [BS_LineItem] = null then "UNMAPPED" else "Mapped",
        type text
    ),
    DefaultedSign = Table.ReplaceValue(
        FlaggedUnmapped,
        null,
        1,
        Replacer.ReplaceValue,
        {"PresentationSign"}
    ),

    // 4. Compute Presented_Balance for SUMIFS & PivotTable reporting
    AddedPresentedBalance = Table.AddColumn(
        DefaultedSign,
        "Presented_Balance",
        each [NetAmount] * [PresentationSign],
        Currency.Type
    ),

    // 5. Final column selection & ordering for Excel Data Model load
    FinalTB_Clean = Table.SelectColumns(
        AddedPresentedBalance,
        {
            "Period_Key",
            "ReportDate",
            "Entity",
            "AccountCode",
            "AccountName",
            "Debit_Amt",
            "Credit_Amt",
            "NetAmount",
            "PresentationSign",
            "Presented_Balance",
            "BS_Group",
            "BS_Section",
            "BS_LineItem",
            "MappingStatus"
        }
    )
in
    FinalTB_Clean
