// Shapes returned by owner_dashboard() and sales_report().

export type Dashboard = {
  from: string;
  to: string;
  days: number;
  sales_total: number;
  sales_count: number;
  cash: number;
  momo: number;
  credit: number;
  retail: number;
  wholesale: number;
  cost_total: number;
  profit: number;
  lines_without_cost: number;
  expenses: number;
  repaid: number;
  per_attendant: { id: string; name: string; total: number; count: number; avg_daily_before: number | null }[];
  money_owed: number;
  debtors: number;
  low_stock: number;
  stock_value: number;
  pending: { requests: number; deliveries: number; cash_ups: number; expenses: number };
  missing_value: number;
  shortages: number;
  signals: {
    discounts: number;
    discount_total: number;
    refunds: number;
    voids: number;
    held: number;
    adjustments: number;
    write_off_value: number;
    over_limit: number;
  };
};

export type DailyPoint = { date: string; retail: number; wholesale: number; count: number };

export type SalesReport = {
  daily: DailyPoint[];
  best_sellers: { product_id: string; name: string; base_unit: string; units: number; revenue: number; cost: number; profit: number }[];
  slow_movers: { product_id: string; name: string; base_unit: string; stock_units: number; stock_value: number; last_sold: string | null }[];
  attendants: { name: string; total: number; count: number; discounts: number; credit: number; days: number; refunds_voids: number }[];
  credit_given: number;
  credit_repaid: number;
  expenses: Record<string, number>;
};
