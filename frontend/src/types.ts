export interface Household {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface Member {
  id: number;
  household_id: number;
  name: string;
  avatar_color?: string;
  is_child: boolean;
  created_at: string;
  updated_at: string;
}

export interface MealType {
  id: number;
  code: string;
  name: string;
  default_sort_order: number;
  is_default_active: boolean;
}

export interface DishStatus {
  id: number;
  household_id: number;
  status_lookup_id: number;
  code: string;
  name: string;
  custom_label?: string;
  color: string;
  is_default: boolean;
  is_active: boolean;
}

export interface CourseType {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
  is_custom: boolean;
}

export interface SourceType {
  id: number;
  name: string;
  icon?: string;
  is_active: boolean;
  is_custom: boolean;
}

export interface MemberPreference {
  member_id: number;
  member_name: string;
  avatar_color?: string;
  rating: 'favorite' | 'neutral' | 'dislike';
}

export interface DishSourceInfo {
  source_type_id?: number;
  source_type_name?: string;
  source_type_icon?: string;
  source_reference?: string;
  source_url?: string;
}

export interface Tag {
  id: number;
  household_id?: number;
  name: string;
  color: string;
}

export interface Dish {
  id: number;
  household_id: number;
  title: string;
  description?: string;
  notes?: string;
  status: {
    id: number;
    code: string;
    name: string;
    color: string;
  };
  courses: Array<{
    id: number;
    name: string;
  }>;
  tags?: Tag[];
  source: DishSourceInfo;
  preferences: MemberPreference[];
  created_at: string;
  updated_at: string;
}

export interface SlotDishNote {
  id: number;
  meal_slot_dish_id: number;
  meal_date: string;
  meal_type_name: string;
  note: string;
  created_at: string;
}

export interface SlotDishRating {
  id: number;
  meal_slot_dish_id: number;
  member_id: number;
  member_name: string;
  avatar_color?: string;
  rating: 'thumbs_up' | 'neutral' | 'thumbs_down';
  created_at: string;
}

export interface SlotDish {
  id: number;
  dish_id: number;
  dish_title: string;
  sort_order: number;
  notes?: string;
  assigned_member_ids?: number[];
  notes_list?: SlotDishNote[];
  ratings?: SlotDishRating[];
  compatibility: {
    status: 'warning' | 'hit' | 'ok';
    severity: 'warning' | 'success' | 'info';
    message: string;
    disliking_members?: Array<{ member_id: number; name: string }>;
    loving_members?: Array<{ member_id: number; name: string }>;
    attendee_count: number;
    is_conflict: boolean;
  };
}

export interface MealSlot {
  id: number;
  household_id: number;
  date: string;
  meal_type: MealType;
  sort_order: number;
  notes?: string;
  dishes: SlotDish[];
  attendee_count: number;
  absent_member_ids: number[];
}

export interface MemberAttendanceSummary {
  member_id: number;
  member_name: string;
  avatar_color?: string;
  is_attending: boolean;
}

export interface MealSlotAttendance {
  meal_slot_id: number;
  date: string;
  meal_type_id: number;
  meal_type_name: string;
  attendee_count: number;
  total_household_members: number;
  members: MemberAttendanceSummary[];
}

export interface DishImportRowError {
  row: number;
  dish_title?: string;
  error: string;
}

export interface DishImportResult {
  total_rows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: DishImportRowError[];
}

