// Category options for the competitor search.
//
// The values are Places API (New) "Table A" type strings, passed straight
// through as `includedType`. Filtering this way is server-side and matches on
// the place's own primary type, which is far more reliable than trying to
// keyword-match a category name in the text query.
//
// Curated rather than exhaustive: Table A has hundreds of types, most of them
// irrelevant to the local businesses this tool is pointed at.

export interface CategoryOption {
  value: string;
  label: string;
}

export interface CategoryGroup {
  group: string;
  options: CategoryOption[];
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    group: "Healthcare",
    options: [
      { value: "doctor", label: "Doctor" },
      { value: "medical_clinic", label: "Medical clinic" },
      { value: "hospital", label: "Hospital" },
      { value: "dentist", label: "Dentist" },
      { value: "dental_clinic", label: "Dental clinic" },
      { value: "physiotherapist", label: "Physiotherapist" },
      { value: "chiropractor", label: "Chiropractor" },
      { value: "skin_care_clinic", label: "Skin care clinic" },
      { value: "medical_lab", label: "Diagnostic lab" },
      { value: "pharmacy", label: "Pharmacy" },
      { value: "drugstore", label: "Drugstore" },
      { value: "veterinary_care", label: "Veterinary care" },
      { value: "wellness_center", label: "Wellness centre" },
    ],
  },
  {
    group: "Beauty & fitness",
    options: [
      { value: "gym", label: "Gym" },
      { value: "fitness_center", label: "Fitness centre" },
      { value: "yoga_studio", label: "Yoga studio" },
      { value: "sports_club", label: "Sports club" },
      { value: "beauty_salon", label: "Beauty salon" },
      { value: "hair_salon", label: "Hair salon" },
      { value: "nail_salon", label: "Nail salon" },
      { value: "barber_shop", label: "Barber shop" },
      { value: "spa", label: "Spa" },
      { value: "massage", label: "Massage" },
    ],
  },
  {
    group: "Food & drink",
    options: [
      { value: "restaurant", label: "Restaurant" },
      { value: "cafe", label: "Cafe" },
      { value: "coffee_shop", label: "Coffee shop" },
      { value: "bakery", label: "Bakery" },
      { value: "bar", label: "Bar" },
      { value: "fast_food_restaurant", label: "Fast food" },
      { value: "ice_cream_shop", label: "Ice cream shop" },
      { value: "meal_delivery", label: "Meal delivery" },
    ],
  },
  {
    group: "Education",
    options: [
      { value: "school", label: "School" },
      { value: "preschool", label: "Preschool" },
      { value: "primary_school", label: "Primary school" },
      { value: "secondary_school", label: "Secondary school" },
      { value: "university", label: "University" },
      { value: "library", label: "Library" },
    ],
  },
  {
    group: "Retail",
    options: [
      { value: "clothing_store", label: "Clothing store" },
      { value: "electronics_store", label: "Electronics store" },
      { value: "furniture_store", label: "Furniture store" },
      { value: "hardware_store", label: "Hardware store" },
      { value: "shoe_store", label: "Shoe store" },
      { value: "book_store", label: "Book store" },
      { value: "pet_store", label: "Pet store" },
      { value: "toy_store", label: "Toy store" },
      { value: "grocery_store", label: "Grocery store" },
      { value: "supermarket", label: "Supermarket" },
      { value: "convenience_store", label: "Convenience store" },
      { value: "department_store", label: "Department store" },
      { value: "shopping_mall", label: "Shopping mall" },
    ],
  },
  {
    group: "Professional services",
    options: [
      { value: "lawyer", label: "Lawyer" },
      { value: "accounting", label: "Accounting" },
      { value: "real_estate_agency", label: "Real estate agency" },
      { value: "insurance_agency", label: "Insurance agency" },
      { value: "travel_agency", label: "Travel agency" },
      { value: "bank", label: "Bank" },
      { value: "courier_service", label: "Courier service" },
      { value: "moving_company", label: "Moving company" },
      { value: "laundry", label: "Laundry" },
      { value: "electrician", label: "Electrician" },
      { value: "plumber", label: "Plumber" },
      { value: "locksmith", label: "Locksmith" },
    ],
  },
  {
    group: "Automotive",
    options: [
      { value: "car_dealer", label: "Car dealer" },
      { value: "car_repair", label: "Car repair" },
      { value: "car_wash", label: "Car wash" },
      { value: "tire_shop", label: "Tyre shop" },
      { value: "gas_station", label: "Petrol pump" },
    ],
  },
  {
    group: "Hospitality",
    options: [
      { value: "hotel", label: "Hotel" },
      { value: "resort_hotel", label: "Resort" },
      { value: "guest_house", label: "Guest house" },
      { value: "hostel", label: "Hostel" },
      { value: "motel", label: "Motel" },
    ],
  },
];

const ALL_CATEGORY_VALUES = new Set(
  CATEGORY_GROUPS.flatMap(g => g.options.map(o => o.value)),
);

/** Guards against an arbitrary `includedType` reaching Google (which 400s). */
export function isValidCategory(value: string): boolean {
  return ALL_CATEGORY_VALUES.has(value);
}

export function categoryLabel(value: string): string | null {
  for (const g of CATEGORY_GROUPS) {
    for (const o of g.options) {
      if (o.value === value) return o.label;
    }
  }
  return null;
}
