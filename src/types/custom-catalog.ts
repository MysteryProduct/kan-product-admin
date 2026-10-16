export type RevisionStatus = 'draft' | 'published' | 'archived';

export interface CustomProductType {
  custom_product_type_id: string;
  type_code: string;
  type_name: string;
  sale_unit: string;
  is_active: boolean;
}

export interface CustomTemplateSummary {
  custom_template_id: string;
  template_code: string;
  template_name: string;
  type_code: string;
  type_name: string;
  sale_unit: string;
  published_revision: number | null;
  draft_revision: number | null;
}

export interface CustomTemplateHead {
  custom_template_id: string;
  template_code: string;
  template_name: string;
  type_code: string;
  type_name: string;
  sale_unit: string;
  revisions: { revision: number; status: RevisionStatus; model_version: string | null; published_at: string | null }[];
}

export interface OptionValue {
  value_key: string;
  value_label: string;
  unit_price_delta: string;
}

export interface OptionGroup {
  group_key: string;
  group_label: string;
  is_required: boolean;
  values: OptionValue[];
}

export interface OptionRule {
  group_key: string;
  value_key: string;
  other_group_key: string;
  other_value_key: string;
  kind: 'requires' | 'excludes';
}

export interface RecipeLine {
  /** Both empty = a base line used whatever the customer picks. */
  group_key: string | null;
  value_key: string | null;
  material_id: string;
  product_unit_id: number;
  qty_per_unit: number;
  setup_qty: number;
}

export interface RevisionDetail {
  custom_template_id: string;
  template_code: string;
  template_name: string;
  type: { type_code: string; type_name: string; sale_unit: string };
  revision: number;
  status: RevisionStatus;
  model_version: string | null;
  description: string | null;
  base_unit_price: string | null;
  min_quantity: number;
  max_quantity: number | null;
  published_at: string | null;
  groups: (OptionGroup & { sort_order: number })[];
  rules: OptionRule[];
  recipe: (RecipeLine & { material_code: string; material_name: string })[];
}

/** What the form edits and the API stores back whole. */
export interface DraftForm {
  template_name: string;
  description: string;
  model_version: string;
  base_unit_price: string;
  min_quantity: string;
  max_quantity: string;
  groups: OptionGroup[];
  rules: OptionRule[];
  recipe: {
    group_key: string;
    value_key: string;
    material_id: string;
    product_unit_id: string;
    qty_per_unit: string;
    setup_qty: string;
  }[];
}
