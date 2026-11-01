/**
 * Shared types for the Staffly DBMS visualization dashboard.
 * Everything here is plain data (JSON-serializable) so it can cross the
 * server -> client component boundary.
 */

export type FkAction = "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION" | "SET DEFAULT";

export interface ColumnFk {
  constraint: string;
  refTable: string;
  refColumn: string;
  onDelete: FkAction;
  onUpdate: FkAction;
}

export interface Column {
  name: string;
  /** Raw SQL type, e.g. "VARCHAR(100)" or "DECIMAL(10,2)". */
  type: string;
  nullable: boolean;
  /** Raw default expression as written in the DDL, or null. */
  defaultValue: string | null;
  autoIncrement: boolean;
  /** Expression for GENERATED ALWAYS AS columns, else null. */
  generatedExpr: string | null;
  isPrimary: boolean;
  /** True when this column alone is covered by a UNIQUE index. */
  isUnique: boolean;
  fk: ColumnFk | null;
}

export interface TableIndex {
  name: string;
  kind: "PRIMARY" | "UNIQUE" | "INDEX";
  columns: string[];
  /** True when the index was declared explicitly (not implied by an FK). */
  explicit: boolean;
}

export interface ForeignKey {
  name: string;
  table: string;
  columns: string[];
  refTable: string;
  refColumns: string[];
  onDelete: FkAction;
  onUpdate: FkAction;
  /** Child column(s) accept NULL -> the relationship is optional. */
  optional: boolean;
  /** Child column(s) are UNIQUE -> relationship is 1:1, otherwise 1:N. */
  oneToOne: boolean;
  selfReference: boolean;
}

export interface CheckConstraint {
  name: string;
  table: string;
  expression: string;
}

export interface Table {
  name: string;
  /** Position in schemas.sql, 1-based. */
  order: number;
  /** Plain-English summary of what the table stores. */
  purpose: string;
  engine: string;
  columns: Column[];
  primaryKey: string[];
  indexes: TableIndex[];
  foreignKeys: ForeignKey[];
  checks: CheckConstraint[];
  /** Foreign keys in other tables that point at this one. */
  referencedBy: ForeignKey[];
}

export interface SchemaStats {
  tables: number;
  columns: number;
  primaryKeys: number;
  foreignKeys: number;
  checks: number;
  uniqueKeys: number;
  indexes: number;
}

export interface SchemaModel {
  database: string;
  sourceFile: string;
  tables: Table[];
  stats: SchemaStats;
}

/** Result of GET /api/live. `connected: false` means the dashboard runs in static mode. */
export interface LiveState {
  connected: boolean;
  database: string;
  host?: string;
  serverVersion?: string;
  /** Exact COUNT(*) per table, present only when connected. */
  rowCounts?: Record<string, number>;
  /** Human-readable reason when not connected. */
  reason?: string;
  checkedAt: string;
}

export type TabId = "overview" | "tables" | "library" | "plans" | "why" | "transactions";

/** Navigation helpers handed to every tab so tabs can link to each other. */
export interface DashboardNav {
  goTo: (tab: TabId) => void;
  openTable: (tableName: string) => void;
  openPlan: (queryId: string) => void;
}

/** Props every tab component receives. */
export interface TabProps {
  schema: SchemaModel;
  live: LiveState | null;
  nav: DashboardNav;
  /** Table selected by nav.openTable, or null. */
  selectedTable: string | null;
  /** Query selected by nav.openPlan, or null. */
  selectedQueryId: string | null;
}

/* ---------- Query library + plans ---------- */

export type AccessType = "const" | "eq_ref" | "ref" | "range" | "index" | "ALL";

export interface PlanNode {
  /** Operator label, e.g. "Nested loop left join", "Index lookup", "Table scan". */
  op: string;
  /** One-line detail, e.g. "employees using PRIMARY (employee_id = ?)". */
  detail: string;
  table?: string;
  access?: AccessType;
  /** Index used, if any. */
  key?: string;
  /** Estimated rows produced per execution (illustrative unless live). */
  rows: number;
  /** Why the optimizer picks this step - shown in the info popover. */
  why: string;
  children: PlanNode[];
}

export interface LibraryQuery {
  id: string;
  title: string;
  /** Python function in backend/employee_backend.py that issues the query. */
  fn: string;
  category: "Lookup" | "Join" | "Aggregate" | "Insert" | "Update" | "Search" | "Auth";
  sql: string;
  /** Sample parameter values for the %s placeholders, in order. */
  params: (string | number)[];
  tables: string[];
  /** DBMS concepts this query demonstrates (short labels). */
  concepts: string[];
  /** Plain-English explanation of what happens and why it matters. */
  summary: string;
  /** Illustrative plan derived from the indexes declared in schemas.sql. */
  plan: PlanNode;
}
