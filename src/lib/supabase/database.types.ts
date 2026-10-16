export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      approval_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          payload: Json
          reason: string | null
          requested_by: string
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          payload?: Json
          reason?: string | null
          requested_by?: string
          status?: string
          type: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          payload?: Json
          reason?: string | null
          requested_by?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cash_ups: {
        Row: {
          amount_handed: number
          attendant_id: string
          business_date: string
          confirmed_amount: number | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          credit_given: number
          expected_cash: number
          expected_momo: number
          handover_method: string
          id: string
          momo_txn_id: string | null
          note: string | null
          shortage: number | null
          status: string
        }
        Insert: {
          amount_handed: number
          attendant_id?: string
          business_date?: string
          confirmed_amount?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          credit_given?: number
          expected_cash?: number
          expected_momo?: number
          handover_method: string
          id?: string
          momo_txn_id?: string | null
          note?: string | null
          shortage?: number | null
          status?: string
        }
        Update: {
          amount_handed?: number
          attendant_id?: string
          business_date?: string
          confirmed_amount?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          credit_given?: number
          expected_cash?: number
          expected_momo?: number
          handover_method?: string
          id?: string
          momo_txn_id?: string | null
          note?: string | null
          shortage?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_ups_attendant_id_fkey"
            columns: ["attendant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_ups_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      credit_payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          method: string
          momo_txn_id: string | null
          note: string | null
          received_by: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          method: string
          momo_txn_id?: string | null
          note?: string | null
          received_by?: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          method?: string
          momo_txn_id?: string | null
          note?: string | null
          received_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          balance: number
          created_at: string
          credit_limit: number
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          type: string
        }
        Insert: {
          balance?: number
          created_at?: string
          credit_limit?: number
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          type?: string
        }
        Update: {
          balance?: number
          created_at?: string
          credit_limit?: number
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          type?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          client_ref: string | null
          created_at: string
          id: string
          invoice_photo_url: string | null
          note: string | null
          received_by: string
          status: string
          supplier_id: string | null
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          client_ref?: string | null
          created_at?: string
          id?: string
          invoice_photo_url?: string | null
          note?: string | null
          received_by?: string
          status?: string
          supplier_id?: string | null
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          client_ref?: string | null
          created_at?: string
          id?: string
          invoice_photo_url?: string | null
          note?: string | null
          received_by?: string
          status?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_item_costs: {
        Row: {
          created_at: string
          delivery_id: string
          delivery_item_id: string
          set_by: string | null
          unit_cost: number
        }
        Insert: {
          created_at?: string
          delivery_id: string
          delivery_item_id: string
          set_by?: string | null
          unit_cost: number
        }
        Update: {
          created_at?: string
          delivery_id?: string
          delivery_item_id?: string
          set_by?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_item_costs_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_item_costs_delivery_item_id_fkey"
            columns: ["delivery_item_id"]
            isOneToOne: true
            referencedRelation: "delivery_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_item_costs_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          created_at: string
          delivery_id: string
          id: string
          pack_id: string | null
          product_id: string
          qty: number
          units: number
        }
        Insert: {
          created_at?: string
          delivery_id: string
          id?: string
          pack_id?: string | null
          product_id: string
          qty: number
          units: number
        }
        Update: {
          created_at?: string
          delivery_id?: string
          id?: string
          pack_id?: string | null
          product_id?: string
          qty?: number
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "product_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          expense_date: string
          id: string
          note: string | null
          paid_by: string
          receipt_photo_url: string | null
          status: string
        }
        Insert: {
          amount: number
          category: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          expense_date?: string
          id?: string
          note?: string | null
          paid_by?: string
          receipt_photo_url?: string | null
          status?: string
        }
        Update: {
          amount?: number
          category?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          expense_date?: string
          id?: string
          note?: string | null
          paid_by?: string
          receipt_photo_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          cost_per_unit: number
          created_at: string
          product_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cost_per_unit: number
          created_at?: string
          product_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cost_per_unit?: number
          created_at?: string
          product_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_costs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_packs: {
        Row: {
          barcode: string | null
          created_at: string
          id: string
          is_active: boolean
          is_quick_sell: boolean
          min_wholesale_qty: number
          name: string
          product_id: string
          retail_price: number
          units_per_pack: number
          wholesale_price: number
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_quick_sell?: boolean
          min_wholesale_qty?: number
          name: string
          product_id: string
          retail_price: number
          units_per_pack: number
          wholesale_price: number
        }
        Update: {
          barcode?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_quick_sell?: boolean
          min_wholesale_qty?: number
          name?: string
          product_id?: string
          retail_price?: number
          units_per_pack?: number
          wholesale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_packs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          base_unit_name: string
          brand: string | null
          category_id: string | null
          created_at: string
          id: string
          is_active: boolean
          is_quick_sell: boolean
          min_wholesale_qty: number
          name: string
          photo_url: string | null
          reorder_level: number
          retail_price: number
          stock_units: number
          track_expiry: boolean
          wholesale_price: number
        }
        Insert: {
          barcode?: string | null
          base_unit_name?: string
          brand?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_quick_sell?: boolean
          min_wholesale_qty?: number
          name: string
          photo_url?: string | null
          reorder_level?: number
          retail_price: number
          stock_units?: number
          track_expiry?: boolean
          wholesale_price: number
        }
        Update: {
          barcode?: string | null
          base_unit_name?: string
          brand?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_quick_sell?: boolean
          min_wholesale_qty?: number
          name?: string
          photo_url?: string | null
          reorder_level?: number
          retail_price?: number
          stock_units?: number
          track_expiry?: boolean
          wholesale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          full_name?: string
          id: string
          is_active?: boolean
          phone?: string | null
          role?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_item_costs: {
        Row: {
          cost_total: number
          created_at: string
          product_id: string
          sale_id: string
          sale_item_id: string
          unit_cost: number
        }
        Insert: {
          cost_total: number
          created_at?: string
          product_id: string
          sale_id: string
          sale_item_id: string
          unit_cost: number
        }
        Update: {
          cost_total?: number
          created_at?: string
          product_id?: string
          sale_id?: string
          sale_item_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_item_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_item_costs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_item_costs_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: true
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          pack_id: string | null
          product_id: string
          qty: number
          sale_id: string
          unit_price: number
          units: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          pack_id?: string | null
          product_id: string
          qty: number
          sale_id: string
          unit_price: number
          units: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          pack_id?: string | null
          product_id?: string
          qty?: number
          sale_id?: string
          unit_price?: number
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "product_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          approval_request_id: string | null
          attendant_id: string
          change_given: number
          client_ref: string | null
          created_at: string
          credit_amount: number
          credit_reversed: number
          customer_id: string | null
          discount: number
          id: string
          momo_txn_id: string | null
          money_returned: number
          note: string | null
          paid_cash: number
          paid_momo: number
          price_mode: string
          receipt_no: string
          reverse_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: string
          subtotal: number
          total: number
        }
        Insert: {
          approval_request_id?: string | null
          attendant_id?: string
          change_given?: number
          client_ref?: string | null
          created_at?: string
          credit_amount?: number
          credit_reversed?: number
          customer_id?: string | null
          discount?: number
          id?: string
          momo_txn_id?: string | null
          money_returned?: number
          note?: string | null
          paid_cash?: number
          paid_momo?: number
          price_mode: string
          receipt_no?: string
          reverse_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
          subtotal: number
          total: number
        }
        Update: {
          approval_request_id?: string | null
          attendant_id?: string
          change_given?: number
          client_ref?: string | null
          created_at?: string
          credit_amount?: number
          credit_reversed?: number
          customer_id?: string | null
          discount?: number
          id?: string
          momo_txn_id?: string | null
          money_returned?: number
          note?: string | null
          paid_cash?: number
          paid_momo?: number
          price_mode?: string
          receipt_no?: string
          reverse_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_attendant_id_fkey"
            columns: ["attendant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_reversed_by_fkey"
            columns: ["reversed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_settings: {
        Row: {
          created_at: string
          currency: string
          id: string
          location: string | null
          low_stock_default: number
          momo_name: string | null
          momo_number: string | null
          phone: string | null
          receipt_footer: string | null
          shop_name: string
          singleton: boolean
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          location?: string | null
          low_stock_default?: number
          momo_name?: string | null
          momo_number?: string | null
          phone?: string | null
          receipt_footer?: string | null
          shop_name?: string
          singleton?: boolean
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          location?: string | null
          low_stock_default?: number
          momo_name?: string | null
          momo_number?: string | null
          phone?: string | null
          receipt_footer?: string | null
          shop_name?: string
          singleton?: boolean
        }
        Relationships: []
      }
      stock_count_items: {
        Row: {
          count_id: string
          counted_at: string | null
          counted_by: string | null
          counted_units: number | null
          created_at: string
          difference_cost: number | null
          difference_units: number | null
          expected_units: number
          id: string
          product_id: string
          unit_cost: number | null
        }
        Insert: {
          count_id: string
          counted_at?: string | null
          counted_by?: string | null
          counted_units?: number | null
          created_at?: string
          difference_cost?: number | null
          difference_units?: number | null
          expected_units: number
          id?: string
          product_id: string
          unit_cost?: number | null
        }
        Update: {
          count_id?: string
          counted_at?: string | null
          counted_by?: string | null
          counted_units?: number | null
          created_at?: string
          difference_cost?: number | null
          difference_units?: number | null
          expected_units?: number
          id?: string
          product_id?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_items_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "stock_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_counted_by_fkey"
            columns: ["counted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          completed_at: string | null
          corrections_applied: boolean
          created_at: string
          id: string
          note: string | null
          started_by: string
          status: string
          type: string
        }
        Insert: {
          completed_at?: string | null
          corrections_applied?: boolean
          created_at?: string
          id?: string
          note?: string | null
          started_by?: string
          status?: string
          type: string
        }
        Update: {
          completed_at?: string | null
          corrections_applied?: boolean
          created_at?: string
          id?: string
          note?: string | null
          started_by?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          balance_after: number
          change_units: number
          created_at: string
          id: string
          note: string | null
          product_id: string
          reason: string
          ref_id: string | null
          ref_table: string | null
          unit_cost: number | null
          user_id: string | null
        }
        Insert: {
          balance_after: number
          change_units: number
          created_at?: string
          id?: string
          note?: string | null
          product_id: string
          reason: string
          ref_id?: string | null
          ref_table?: string | null
          unit_cost?: number | null
          user_id?: string | null
        }
        Update: {
          balance_after?: number
          change_units?: number
          created_at?: string
          id?: string
          note?: string | null
          product_id?: string
          reason?: string
          ref_id?: string | null
          ref_table?: string | null
          unit_cost?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          balance_owed: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          balance_owed?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          balance_owed?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accra_today: { Args: never; Returns: string }
      adjust_stock: {
        Args: {
          p_change: number
          p_note: string
          p_product_id: string
          p_reason: string
        }
        Returns: undefined
      }
      apply_sale_effects: { Args: { p_sale_id: string }; Returns: undefined }
      apply_stock_adjustment: {
        Args: {
          p_change: number
          p_note: string
          p_product_id: string
          p_reason: string
        }
        Returns: undefined
      }
      attendant_day: {
        Args: { p_attendant: string; p_date: string }
        Returns: Json
      }
      complete_sale: {
        Args: {
          p_client_ref?: string
          p_customer_id?: string
          p_discount?: number
          p_items: Json
          p_note?: string
          p_payment?: Json
          p_price_mode: string
        }
        Returns: Json
      }
      complete_stock_count: {
        Args: { p_apply: boolean; p_count_id: string }
        Returns: Json
      }
      confirm_cash_up: {
        Args: {
          p_cash_up_id: string
          p_confirmed_amount: number
          p_note?: string
        }
        Returns: Json
      }
      confirm_delivery: {
        Args: {
          p_costs: Json
          p_delivery_id: string
          p_note?: string
          p_status: string
        }
        Returns: undefined
      }
      count_sheet: { Args: { p_count_id: string }; Returns: Json }
      current_staff_role: { Args: never; Returns: string }
      customer_statement: {
        Args: { p_customer_id: string }
        Returns: {
          balance: number
          credit: number
          debit: number
          description: string
          happened_at: string
          kind: string
          reference: string
        }[]
      }
      day_totals: {
        Args: { p_attendant: string; p_date: string }
        Returns: Json
      }
      debtors: {
        Args: never
        Returns: {
          balance: number
          credit_limit: number
          days_owed: number
          id: string
          last_payment_at: string
          name: string
          oldest_unpaid_at: string
          phone: string
          type: string
        }[]
      }
      decide_approval: {
        Args: { p_approve: boolean; p_reason?: string; p_request_id: string }
        Returns: Json
      }
      delivery_details: { Args: { p_delivery_id: string }; Returns: Json }
      import_products: { Args: { p_rows: Json }; Returns: Json }
      is_owner: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      list_staff: {
        Args: never
        Returns: {
          approved_at: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_sign_in_at: string
          phone: string
          role: string
        }[]
      }
      missing_stock_report: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      my_day: { Args: { p_date?: string }; Returns: Json }
      owner_dashboard: { Args: { p_from: string; p_to: string }; Returns: Json }
      record_credit_payment: {
        Args: {
          p_amount: number
          p_customer_id: string
          p_method: string
          p_momo_txn_id?: string
          p_note?: string
        }
        Returns: Json
      }
      record_delivery: {
        Args: {
          p_client_ref?: string
          p_items: Json
          p_note?: string
          p_photo_path?: string
          p_supplier_id: string
        }
        Returns: Json
      }
      refund_sale: {
        Args: { p_reason: string; p_sale_id: string }
        Returns: Json
      }
      request_approval: {
        Args: { p_payload: Json; p_type: string }
        Returns: string
      }
      reverse_sale: {
        Args: { p_reason: string; p_sale_id: string; p_status: string }
        Returns: Json
      }
      sale_receipt: { Args: { p_sale_id: string }; Returns: Json }
      sales_report: { Args: { p_from: string; p_to: string }; Returns: Json }
      save_product: { Args: { p: Json }; Returns: string }
      set_delivery_item_cost: {
        Args: { p_cost_per_unit: number; p_item_id: string }
        Returns: undefined
      }
      start_stock_count: {
        Args: { p_note?: string; p_product_ids?: string[]; p_type: string }
        Returns: string
      }
      submit_cash_up: {
        Args: {
          p_amount: number
          p_business_date: string
          p_method: string
          p_momo_txn_id?: string
          p_note?: string
        }
        Returns: Json
      }
      submit_count_item: {
        Args: {
          p_count_id: string
          p_counted_units: number
          p_product_id: string
        }
        Returns: undefined
      }
      update_staff_access: {
        Args: { p_is_active: boolean; p_role: string; p_user_id: string }
        Returns: undefined
      }
      void_sale: {
        Args: { p_reason: string; p_sale_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
