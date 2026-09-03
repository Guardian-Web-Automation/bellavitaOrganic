import { test as base } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { HeaderComponent } from '../pages/HeaderComponent';
import { SearchResultsPage } from '../pages/SearchResultsPage';
import { StorePasswordPage } from '../pages/StorePasswordPage';
import { ProductPage } from '../pages/ProductPage';
import { CartDrawer } from '../pages/CartDrawer';
import { CollectionPage } from '../pages/CollectionPage';
import { MenuDrawer } from '../pages/MenuDrawer';
import { SearchPopup } from '../pages/SearchPopup';
import { CustomSearchResultsPage } from '../pages/CustomSearchResultsPage';
import { BoxBuilder } from '../pages/BoxBuilder';

type Pages = {
  homePage: HomePage;
  headerComponent: HeaderComponent;
  searchResultsPage: SearchResultsPage;
  storePasswordPage: StorePasswordPage;
  productPage: ProductPage;
  cartDrawer: CartDrawer;
  collectionPage: CollectionPage;
  menuDrawer: MenuDrawer;
  searchPopup: SearchPopup;
  customSearchResultsPage: CustomSearchResultsPage;
  boxBuilder: BoxBuilder;
};

export const test = base.extend<Pages>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  headerComponent: async ({ page }, use) => {
    await use(new HeaderComponent(page));
  },
  searchResultsPage: async ({ page }, use) => {
    await use(new SearchResultsPage(page));
  },
  storePasswordPage: async ({ page }, use) => {
    await use(new StorePasswordPage(page));
  },
  productPage: async ({ page }, use) => {
    await use(new ProductPage(page));
  },
  cartDrawer: async ({ page }, use) => {
    await use(new CartDrawer(page));
  },
  collectionPage: async ({ page }, use) => {
    await use(new CollectionPage(page));
  },
  menuDrawer: async ({ page }, use) => {
    await use(new MenuDrawer(page));
  },
  searchPopup: async ({ page }, use) => {
    await use(new SearchPopup(page));
  },
  customSearchResultsPage: async ({ page }, use) => {
    await use(new CustomSearchResultsPage(page));
  },
  boxBuilder: async ({ page }, use) => {
    await use(new BoxBuilder(page));
  },
});

export { expect } from '@playwright/test';
