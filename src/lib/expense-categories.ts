export const EXPENSE_CATEGORIES = ["rent", "electricity", "transport", "salary", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
