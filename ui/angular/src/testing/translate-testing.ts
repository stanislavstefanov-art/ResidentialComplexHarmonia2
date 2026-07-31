import { Observable, of } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';

class FakeLoader implements TranslateLoader {
  getTranslation(_lang: string): Observable<object> {
    return of({});
  }
}

export function provideTranslateTesting() {
  return provideTranslateService({
    loader: { provide: TranslateLoader, useClass: FakeLoader },
  });
}
