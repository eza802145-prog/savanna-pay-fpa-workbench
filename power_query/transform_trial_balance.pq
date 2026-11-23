// ============================================================================
// Savanna Pay Ltd — Power Query M Script: Trial Balance Consolidation & Cleaning
// File: power_query/transform_trial_balance.pq
// Entity: Savanna Pay Ltd | 125 Itire Road, Lawson Bus Stop, Surulere, Lagos
// ============================================================================

let
    // 1. Connect to source folder of monthly Trial Balance CSV/Excel exports
    Source = Folder.Files("C:\FP&A\SavannaPay\data"),
    FilteredTBFiles = Table.SelectRows(
        Source,
        each Text.StartsWith([Name], "savanna_pay_tb_") and ([Extension] = ".csv" or [Extension] = ".xlsx")
    ),

    // 2. Parse each CSV with UTF-8 encoding and promote headers
    AddedParsedTables = Table.AddColumn(
        FilteredTBFiles,
        "RawTable",
        each Table.PromoteHeaders(
            Csv.Document([Content], [Delimiter = ",", Columns = 5, Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
            [PromoteAllScalars = true]
        )
    ),
    RemovedFileMetadata = Table.SelectColumns(AddedParsedTables, {"Name", "RawTable"}),
    ExpandedRows = Table.ExpandTableColumn(
        RemovedFileMetadata,
        "RawTable",
        {"ReportDate", "Account_Code_Name", "Debit_Amt", "Credit_Amt", "Entity"},
        {"ReportDate", "Account_Code_Name", "Debit_Amt", "Credit_Amt", "Entity"}
    ),

    // 3. Remove blank lines, ERP subtotals, and summary check rows
    TrimmedText = Table.TransformColumns(
        ExpandedRows,
        {{"Account_Code_Name", each Text.Trim(Text.From(_)), type text}}
    ),
    FilteredValidRows = Table.SelectRows(
        TrimmedText,
        each [Account_Code_Name] <> null
            and [Account_Code_Name] <> ""
            and not Text.Contains(Text.Upper([Account_Code_Name]), "SUBTOTAL")
            and not Text.Contains(Text.Upper([Account_Code_Name]), "GRAND TOTAL")
            and not Text.Contains(Text.Upper([Account_Code_Name]), "NET TRIAL BALANCE")
    ),

    // 4. Split combined "AccountCode - AccountName" into explicit Text keys
    SplitAccountColumn = Table.SplitColumn(
        FilteredValidRows,
        "Account_Code_Name",
        Splitter.SplitTextByDelimiter(" - ", QuoteStyle.Csv),
        {"AccountCode", "AccountName"}
    ),
    CleanedAccountKeys = Table.TransformColumns(
        SplitAccountColumn,
        {
            {"AccountCode", each Text.Trim(Text.From(_)), type text},
            {"AccountName", each Text.Trim(Text.From(_)), type text}
        }
    ),

    // 5. Standardize dates and parse formatted NGN currency strings
    ParsedDates = Table.TransformColumnTypes(CleanedAccountKeys, {{"ReportDate", type date}}),
    AddedPeriodKey = Table.AddColumn(
        ParsedDates,
        "Period_Key",
        each Date.ToText([ReportDate], "MMM-yy"),
        type text
    ),
    ReplacedCurrencyChars = Table.ReplaceValue(
        AddedPeriodKey,
        "₦",
        "",
        Replacer.ReplaceText,
        {"Debit_Amt", "Credit_Amt"}
    ),
    TypedAmounts = Table.TransformColumnTypes(
        ReplacedCurrencyChars,
        {{"Debit_Amt", Currency.Type}, {"Credit_Amt", Currency.Type}}
    ),
    ReplacedNulls = Table.ReplaceValue(TypedAmounts, null, 0, Replacer.ReplaceValue, {"Debit_Amt", "Credit_Amt"}),

    // 6. Compute signed NetAmount (Debit - Credit) & deduplicate export artifacts
    AddedNetAmount = Table.AddColumn(
        ReplacedNulls,
        "NetAmount",
        each [Debit_Amt] - [Credit_Amt],
        Currency.Type
    ),
    DeduplicatedRows = Table.Distinct(
        AddedNetAmount,
        {"Period_Key", "AccountCode", "Debit_Amt", "Credit_Amt"}
    )
in
    DeduplicatedRows
