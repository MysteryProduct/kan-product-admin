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
  /** `#rrggbb`; set on every value of the colour group, empty elsewhere. */
  color_hex?: string | null;
}

export interface OptionGroup {
  group_key: string;
  group_label: string;
  is_required: boolean;
  /** The one group whose values colour the product body. */
  is_color_group?: boolean;
  values: OptionValue[];
}

export interface ModelFace {
  width_mm: number;
  height_mm: number;
  mesh?: string;
}

/** Print areas (mm), cup profile and the mesh names picked in the GLB. */
export interface ModelConfig {
  faces: { front: ModelFace; back?: ModelFace };
  cup?: {
    top_diameter_mm: number;
    bottom_diameter_mm: number;
    height_mm: number;
    margin_top_mm: number;
    margin_bottom_mm: number;
  };
  body_mesh?: string;
}

export interface ModelMesh {
  name: string;
  triangles: number;
  has_uv: boolean;
}

export interface ModelFileInfo {
  custom_model_file_id: string;
  original_name: string;
  size_bytes: number;
  triangle_count: number;
  meshes: ModelMesh[];
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

export type Decoration = 'laser' | 'sticker';

export interface RevisionDetail {
  custom_template_id: string;
  template_code: string;
  template_name: string;
  type: { type_code: string; type_name: string; sale_unit: string };
  revision: number;
  status: RevisionStatus;
  model_version: string | null;
  // How a cup is decorated; null = never set (the Store reads laser).
  decoration: Decoration | null;
  description: string | null;
  base_unit_price: string | null;
  min_quantity: number;
  max_quantity: number | null;
  published_at: string | null;
  model_config: ModelConfig | null;
  model_file: ModelFileInfo | null;
  groups: (OptionGroup & { sort_order: number })[];
  rules: OptionRule[];
  recipe: (RecipeLine & { material_code: string; material_name: string })[];
}

export type ModelShape = 'flat' | 'shirt' | 'cup';

/** Millimetres typed as text, like every other number in the form. */
export interface ModelForm {
  shape: ModelShape;
  front: { width: string; height: string; mesh: string };
  back: { width: string; height: string; mesh: string };
  cup: { top: string; bottom: string; height: string; marginTop: string; marginBottom: string };
  body_mesh: string;
}

/** What the form edits and the API stores back whole. */
export interface DraftForm {
  model: ModelForm;
  template_name: string;
  description: string;
  model_version: string;
  // '' = not set.
  decoration: Decoration | '';
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
