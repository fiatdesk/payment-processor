import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ConfigService } from '../../data';

@Injectable({
  providedIn: 'root',
})
export class MetaService {
  private readonly titleService = inject(Title);
  private readonly configService = inject(ConfigService);

  SetMetaTitle(title: string): void {
    const platformName = this.configService.GetPlatformName();
    const platformString =
      platformName === 'FiatDesk' ? '' : `– ${platformName}`;
    let fullTitle = `${title} ${platformString} – FiatDesk`;
    if (this.configService.IsTestMode()) {
      fullTitle += ` [Test]`;
    }
    this.titleService.setTitle(fullTitle);
  }
}
