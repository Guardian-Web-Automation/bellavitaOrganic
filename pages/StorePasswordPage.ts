import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class StorePasswordPage extends BasePage {
  private readonly enterUsingPasswordLink = this.page.getByText('Enter using password');
  private readonly passwordInput = this.page.locator('input[name="password"]:visible');
  private readonly submitButton = this.page.locator('#login_form button[type="submit"]');

  constructor(page: Page) {
    super(page);
  }

  async isShown(): Promise<boolean> {
    return this.page.url().includes('/password');
  }

  async unlock(password: string): Promise<void> {
    if (await this.enterUsingPasswordLink.isVisible().catch(() => false)) {
      await this.enterUsingPasswordLink.click();
    }
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    await this.page.waitForURL((url) => !url.pathname.includes('/password'), { timeout: 30_000 });
  }
}
