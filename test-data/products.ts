// Test data for the Bellavita Organic store, filled from live exploration.
//
// `primary` is a real, in-stock product. It has a single variant (100ml), so
// there are no option swatches to switch between — the variant-switching test
// was removed from tests/pdp.spec.ts and `variants` is intentionally empty.
export const products = {
  primary: {
    handle: 'white-oud-unisex-perfume',
    variants: [] as string[],
  },
};

export const collections = {
  // "Shop All" — the store's catch-all collection (24+ products).
  primary: 'shop-all-products',
};
