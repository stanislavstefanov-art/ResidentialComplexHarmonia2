import {
  Component, OnInit, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';
import { ReservationsService } from './reservations.service';
import { Slot } from './models';
import { RoleService } from '../role.service';
import { LanguageService, PRIMENG_TRANSLATIONS } from '../language.service';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

// ── Constants ────────────────────────────────────────────────────────────────
const TZ = 'Europe/Sofia';
const H_START = 8;        // first bookable hour (8:00)
const H_END = 23;         // last bookable hour start (23:00-24:00); 16 cells total
const EVENING_START = 17;
const EVENING_END = 23;
const STRIP_DAYS = 14;
const MAX_AHEAD = 60;

// ── Types ────────────────────────────────────────────────────────────────────
type HourState = 'free' | 'occupied' | 'past' | 'sel' | 'sel-start' | 'mine';

interface PrimTranslation {
  dayNames: string[];
  dayNamesMin: string[];
  monthNames: string[];
}

interface DayCell {
  date: Date;
  abbr: string;
  num: number;
  isPast: boolean;
  isToday: boolean;
  isSelected: boolean;
  key: string;
}

interface HourCell {
  hour: number;
  slotKey: string;
  state: HourState;
}

interface UpcomingEntry {
  sortKey: string;
  label: string;
  dayName: string;
  range: string;
}

// ── Pure helpers (module scope) ───────────────────────────────────────────────
function sofiaDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function todayLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function sofiaHourNow(): number {
  const s = new Date().toLocaleTimeString('en-US', { timeZone: TZ, hour: '2-digit', hour12: false });
  return parseInt(s.slice(0, 2), 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function parseHour(slotKey: string): number {
  if (/^\d{4}$/.test(slotKey)) return Math.floor(parseInt(slotKey, 10) / 100);
  const m = slotKey.match(/^(\d{1,2})/);
  return m ? parseInt(m[1], 10) : -1;
}

function fmtHour(h: number): string {
  return String(h).padStart(2, '0') + ':00';
}

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CardModule,
    ProgressSpinnerModule,
    ToastModule,
    TranslatePipe,
    LanguageSwitcherComponent,
  ],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="harmonia-shell">

      <!-- Header -->
      <header class="harmonia-header">
        <span class="harmonia-logo">🏡 {{ 'app.brand' | translate }}</span>
        <span class="harmonia-subtitle">{{ 'app.subtitle' | translate }}</span>
        <div class="flex-spacer"></div>
        <a routerLink="/notifications" class="nav-link">{{ 'nav.notifications' | translate }}</a>
        <a routerLink="/directory" class="nav-link">{{ 'nav.directory' | translate }}</a>
        <a routerLink="/reservations" class="nav-link nav-active">{{ 'nav.reservations' | translate }}</a>
        <a routerLink="/financial" class="nav-link">{{ 'nav.finance' | translate }}</a>
        <a routerLink="/contact-edit" class="nav-link">{{ 'nav.contactEdit' | translate }}</a>
        @if (isAdmin) { <a routerLink="/admin-pending" class="nav-link">{{ 'nav.adminPending' | translate }}</a> }
        <a routerLink="/privacy" class="nav-link">{{ 'nav.privacy' | translate }}</a>
        <app-language-switcher />
      </header>

      <main class="harmonia-content">
        <p-card>
          <ng-template #title>{{ 'reservation.newReservation' | translate }}</ng-template>
          <ng-template #content>

            <!-- View mode toggle -->
            <div class="view-toggle">
              <button class="vt-btn" [class.vt-active]="viewMode() === 'timeline'" (click)="setViewMode('timeline')">
                {{ 'reservation.viewTimeline' | translate }}
              </button>
              <button class="vt-btn" [class.vt-active]="viewMode() === 'cards'" (click)="setViewMode('cards')">
                {{ 'reservation.viewCards' | translate }}
              </button>
            </div>

            <!-- Week navigation -->
            <div class="week-nav">
              <button class="arrow-btn" (click)="prevWeek()" aria-label="Предишна седмица">&#8249;</button>
              <span class="month-label">{{ monthLabel() }}</span>
              <button class="arrow-btn" [disabled]="!canGoNext()" (click)="nextWeek()" aria-label="Следваща седмица">&#8250;</button>
            </div>

            <!-- Day strip -->
            <div class="day-strip" role="group" aria-label="Изберете дата">
              @for (day of visibleDays(); track day.key) {
                <button
                  class="day-btn"
                  [class.day-selected]="day.isSelected"
                  [class.day-past]="day.isPast"
                  [class.day-today]="day.isToday && !day.isSelected"
                  [attr.aria-pressed]="day.isSelected"
                  [attr.aria-label]="day.abbr + ' ' + day.num"
                  [disabled]="day.isPast"
                  (click)="selectDay(day)"
                >
                  <span class="day-abbr">{{ day.abbr }}</span>
                  <span class="day-num">{{ day.num }}</span>
                  @if (day.isToday && !day.isSelected) {
                    <span class="day-dot" aria-hidden="true">•</span>
                  }
                </button>
              }
            </div>

            <!-- Booking area: only shown after a date is selected -->
            @if (selectedDate()) {

              @if (loadingCurrent()) {
                <div class="spinner-wrap">
                  <p-progressspinner strokeWidth="4" [style]="{width:'40px',height:'40px'}" />
                </div>

              } @else if (slotError()) {
                <div class="center-state" data-testid="error-state">
                  <p class="err-text">{{ slotError() }}</p>
                  <button class="retry-btn" data-testid="retry-btn" (click)="retryLoad()">
                    {{ 'common.retry' | translate }}
                  </button>
                </div>

              } @else if (viewMode() === 'timeline') {

                <!-- Hour timeline -->
                <div class="timeline-scroll-wrap">
                  <div class="timeline" role="group" [attr.aria-label]="'reservation.hintSelectStart' | translate">
                    @for (cell of hourCells(); track cell.hour) {
                      <button
                        class="hour-btn"
                        [class.h-free]="cell.state === 'free'"
                        [class.h-occ]="cell.state === 'occupied'"
                        [class.h-past]="cell.state === 'past'"
                        [class.h-sel]="cell.state === 'sel'"
                        [class.h-start]="cell.state === 'sel-start'"
                        [class.h-mine]="cell.state === 'mine'"
                        [disabled]="cell.state === 'occupied' || cell.state === 'past' || cell.state === 'mine'"
                        [attr.title]="cell.state === 'mine' ? ('reservation.yours' | translate) : null"
                        [attr.aria-label]="cell.hour + ':00'"
                        [attr.aria-pressed]="cell.state === 'sel' || cell.state === 'sel-start'"
                        [attr.data-hour]="cell.hour"
                        (click)="onHourTap(cell)"
                      >{{ cell.hour }}</button>
                    }
                  </div>
                </div>

                <!-- Legend -->
                <div class="legend">
                  <span class="leg leg-mine"><span class="mine-swatch" aria-hidden="true"></span>{{ 'reservation.yours' | translate }}</span>
                  <span class="leg leg-sel">&#9679; {{ 'reservation.legendSelected' | translate }}</span>
                  <span class="leg leg-occ">&#9679; {{ 'reservation.legendOccupied' | translate }}</span>
                  <span class="leg leg-free">&#9675; {{ 'reservation.free' | translate }}</span>
                  <span class="leg leg-past">&#9675; {{ 'reservation.legendPast' | translate }}</span>
                </div>

                <!-- Duration chips + action bar -->
                <div class="bottom-area">
                  <div class="dur-row">
                    <span class="dur-label">{{ 'reservation.duration' | translate }}</span>
                    @for (n of durations; track n) {
                      <button
                        class="dur-chip"
                        [class.dur-active]="isDurActive(n)"
                        [disabled]="startHour() === null"
                        (click)="setDuration(n)"
                      >{{ n }} ч</button>
                    }
                    <button
                      class="dur-chip"
                      [class.dur-active]="isEveningActive()"
                      (click)="setWholeEvening()"
                    >{{ 'reservation.wholeEvening' | translate }}</button>
                  </div>

                  @if (bookSummary()) {
                    <div class="action-bar">
                      <span class="summary-pill">{{ bookSummary() }}</span>
                      <button class="book-btn" [disabled]="booking()" (click)="book()">
                        {{ 'reservation.book' | translate }}
                      </button>
                    </div>
                  } @else {
                    <p class="hint-text">
                      {{
                        (startHour() !== null ? 'reservation.hintSelectEnd' : 'reservation.hintSelectStart')
                          | translate
                      }}
                    </p>
                  }

                  @if (bookError()) {
                    <p class="hint-text err-text">{{ bookError() }}</p>
                  }
                </div>

              } @else {

                <!-- Card grid -->
                <div class="slot-grid" role="group">
                  @for (card of cardSlots(); track card.hour) {
                    <div class="slot-card"
                      [class.sc-free]="card.state === 'free' && !card.isPast"
                      [class.sc-mine]="card.state === 'taken-mine'"
                      [class.sc-other]="card.state === 'taken-other'"
                      [class.sc-past]="card.isPast">
                      <span class="sc-hour">{{ card.hour | number:'2.0-0' }}:00</span>
                      <span class="sc-badge">
                        @if (card.isPast) { {{ 'reservation.legendPast' | translate }}
                        } @else if (card.state === 'taken-mine') { {{ 'reservation.yours' | translate }}
                        } @else if (card.state === 'taken-other') { {{ 'reservation.taken' | translate }}
                        } @else { {{ 'reservation.free' | translate }} }
                      </span>
                      @if (card.state === 'free' && !card.isPast) {
                        <button class="sc-btn"
                          [disabled]="claimingSlot() === card.slotKey"
                          (click)="claimSingle(card.slotKey)">
                          {{ (claimingSlot() === card.slotKey ? 'reservation.claiming' : 'reservation.book') | translate }}
                        </button>
                      }
                    </div>
                  }
                </div>

              }

            } @else {
              <p class="hint-text">{{ 'reservation.hintSelectDate' | translate }}</p>
            }

          </ng-template>
        </p-card>

        <!-- Upcoming reservations -->
        <section class="upcoming" aria-labelledby="upcoming-heading">
          <h3 id="upcoming-heading" class="upcoming-title">
            {{ 'reservation.upcomingTitle' | translate }}
          </h3>
          @if (upcoming().length === 0) {
            <p class="upcoming-empty">{{ 'reservation.upcomingEmpty' | translate }}</p>
          } @else {
            @for (r of upcoming(); track r.sortKey) {
              <div class="upcoming-row">
                <span class="upc-date">{{ r.label }}</span>
                <span class="upc-day">{{ r.dayName }}</span>
                <span class="upc-range">{{ r.range }}</span>
              </div>
            }
          }
        </section>

      </main>
    </div>
  `,
  styles: [`
    /* Shell */
    .harmonia-shell { min-height: 100vh; background: #f5f5f0; }
    .harmonia-header {
      display: flex; align-items: center; gap: 12px;
      background: #2e6b4f; color: white; padding: 12px 24px;
    }
    .harmonia-logo { font-size: 1.25rem; font-weight: 700; }
    .harmonia-subtitle { opacity: .7; font-size: .85rem; }
    .flex-spacer { flex: 1; }
    .nav-link {
      color: rgba(255,255,255,.75); text-decoration: none;
      padding: 6px 12px; border-radius: 6px; font-size: .875rem;
    }
    .nav-link:hover { background: rgba(255,255,255,.1); }
    .nav-active { background: rgba(255,255,255,.22); color: white; font-weight: 600; }
    .harmonia-content {
      max-width: 960px; margin: 0 auto; padding: 24px 16px;
      display: flex; flex-direction: column; gap: 20px;
    }

    /* Week navigation */
    .week-nav { display: flex; align-items: center; margin-bottom: 12px; }
    .arrow-btn {
      flex-shrink: 0; width: 32px; height: 32px; border-radius: 4px;
      background: white; border: 1px solid #d9d9d9; color: #333;
      font-size: 1.125rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .arrow-btn:hover { background: #f0f0f0; }
    .month-label { flex: 1; text-align: center; font-size: .9rem; color: #555; font-weight: 500; }

    /* Day strip */
    .day-strip {
      display: flex; gap: 4px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 16px;
      scrollbar-width: none;
    }
    .day-strip::-webkit-scrollbar { display: none; }
    .day-btn {
      flex-shrink: 0; min-width: 52px; padding: 6px 4px;
      background: white; border: 1px solid #d9d9d9; border-radius: 6px;
      cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px;
      transition: border-color .15s, background .15s; position: relative;
    }
    .day-btn:hover:not(:disabled) { border-color: #2e6b4f; background: #f0f7f3; }
    .day-btn:disabled { cursor: not-allowed; opacity: .45; }
    .day-btn.day-selected { border: 2px solid #2e6b4f; background: #e8f3ed; }
    .day-btn.day-today { border-color: #2e6b4f; }
    .day-abbr { font-size: .65rem; color: #777; text-transform: uppercase; }
    .day-btn.day-selected .day-abbr { color: #2e6b4f; }
    .day-num { font-size: 1.05rem; font-weight: 600; line-height: 1; }
    .day-btn.day-selected .day-num { color: #2e6b4f; }
    .day-dot { position: absolute; bottom: 3px; font-size: .45rem; color: #2e6b4f; }

    /* Hour timeline */
    .timeline-scroll-wrap { overflow-x: auto; scrollbar-width: thin; margin-bottom: 8px; }
    .timeline { display: flex; gap: 4px; min-width: max-content; padding: 4px 0; }
    .hour-btn {
      min-width: 54px; height: 50px; border-radius: 4px;
      background: #f4f4f4; border: 1px solid #ddd;
      font-size: .9rem; font-weight: 500; cursor: pointer; color: #333;
      transition: background .12s, border-color .12s, color .12s;
    }
    .hour-btn:focus-visible { outline: 2px solid #2e6b4f; outline-offset: 2px; }
    .hour-btn:hover:not(:disabled) { border-color: #2e6b4f; background: #e8f3ed; }
    .hour-btn:disabled { cursor: not-allowed; }
    .hour-btn.h-occ { background: #e53935; border-color: #c62828; color: white; }
    .hour-btn.h-past { background: #ebebeb; color: #bbb; border-color: #ddd; }
    .hour-btn.h-mine { background: #b2d4bf; border-color: #2e6b4f; color: #1a3d2b; }
    .hour-btn.h-sel { background: #2e6b4f; border-color: #1e4f37; color: white; }
    .hour-btn.h-start {
      background: #2e6b4f; border-color: #1a3d2b; color: white;
      box-shadow: 0 0 0 2.5px white, 0 0 0 4px #2e6b4f;
    }

    /* Legend */
    .legend { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 12px; }
    .leg { font-size: .78rem; color: #555; }
    .leg-mine { color: #1a3d2b; }
    .mine-swatch { display: inline-block; width: 14px; height: 11px; background: #b2d4bf; border: 1.5px solid #2e6b4f; border-radius: 2px; vertical-align: middle; margin-right: 4px; }
    .leg-sel { color: #2e6b4f; font-style: italic; }
    .leg-occ { color: #e53935; }
    .leg-free { color: #aaa; }
    .leg-past { color: #ccc; }

    /* Duration & action */
    .bottom-area { display: flex; flex-direction: column; gap: 10px; }
    .dur-row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
    .dur-label { font-size: .85rem; color: #555; margin-right: 2px; }
    .dur-chip {
      padding: 5px 14px; border-radius: 16px; font-size: .85rem;
      background: white; border: 1px solid #bbb; cursor: pointer; color: #333;
      transition: background .12s, border-color .12s, color .12s;
    }
    .dur-chip:hover:not(:disabled) { border-color: #2e6b4f; background: #f0f7f3; }
    .dur-chip:disabled { opacity: .45; cursor: not-allowed; }
    .dur-chip.dur-active { background: #2e6b4f; border-color: #2e6b4f; color: white; font-weight: 600; }

    .action-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .summary-pill {
      display: inline-flex; align-items: center;
      background: #e8f3ed; color: #2e6b4f; border: 1px solid #b2d4bf;
      border-radius: 20px; padding: 6px 16px; font-size: .875rem; font-weight: 500;
    }
    .book-btn {
      background: #2e6b4f; color: white; border: none;
      padding: 10px 24px; border-radius: 6px; font-size: .95rem; font-weight: 600;
      cursor: pointer; transition: background .15s;
    }
    .book-btn:hover:not(:disabled) { background: #1e4f37; }
    .book-btn:disabled { opacity: .6; cursor: not-allowed; }

    /* Misc */
    .hint-text { color: #777; font-size: .875rem; margin: 8px 0 0; }
    .err-text { color: #c62828; }
    .retry-btn {
      background: transparent; border: 1px solid #bbb; padding: 6px 16px;
      border-radius: 6px; cursor: pointer; font-size: .875rem; color: #555;
    }
    .retry-btn:hover { border-color: #2e6b4f; color: #2e6b4f; }
    .spinner-wrap { display: flex; justify-content: center; padding: 32px; }
    .center-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px 0; }

    /* View toggle */
    .view-toggle { display: flex; gap: 6px; margin-bottom: 16px; }
    .vt-btn {
      padding: 5px 16px; border-radius: 16px; font-size: .85rem;
      background: white; border: 1px solid #bbb; cursor: pointer; color: #555;
      transition: background .12s, border-color .12s, color .12s;
    }
    .vt-btn:hover { border-color: #2e6b4f; color: #2e6b4f; }
    .vt-btn.vt-active { background: #2e6b4f; border-color: #2e6b4f; color: white; font-weight: 600; }

    /* Card grid */
    .slot-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 10px; margin-bottom: 12px;
    }
    .slot-card {
      border: 1px solid #ddd; border-left: 4px solid #aaa;
      border-radius: 6px; padding: 10px 12px;
      display: flex; flex-direction: column; gap: 6px;
      background: white;
    }
    .slot-card.sc-free { border-left-color: #2e6b4f; }
    .slot-card.sc-mine { border-left-color: #1976d2; }
    .slot-card.sc-other { border-left-color: #e53935; }
    .slot-card.sc-past { border-left-color: #ccc; opacity: .6; }
    .sc-hour { font-size: .95rem; font-weight: 700; color: #333; }
    .sc-badge { font-size: .75rem; color: #666; }
    .slot-card.sc-free .sc-badge { color: #2e6b4f; }
    .slot-card.sc-mine .sc-badge { color: #1976d2; }
    .slot-card.sc-other .sc-badge { color: #e53935; }
    .sc-btn {
      margin-top: 2px; padding: 5px 0; border-radius: 4px;
      background: #2e6b4f; color: white; border: none;
      font-size: .8rem; font-weight: 600; cursor: pointer;
      transition: background .12s;
    }
    .sc-btn:hover:not(:disabled) { background: #1e4f37; }
    .sc-btn:disabled { opacity: .6; cursor: not-allowed; }

    /* Upcoming */
    .upcoming { padding: 0; }
    .upcoming-title { font-size: .9rem; color: #2e6b4f; margin: 0 0 8px; font-weight: 400; }
    .upcoming-empty { color: #2e6b4f; font-size: .875rem; margin: 0; }
    .upcoming-row {
      display: flex; align-items: baseline; gap: 12px;
      padding: 10px 0; border-bottom: 1px solid #eee; font-size: .875rem;
    }
    .upc-date { font-weight: 600; min-width: 38px; }
    .upc-day { color: #555; flex: 1; }
    .upc-range {
      background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 4px;
      padding: 2px 8px; font-size: .8rem; color: #444; white-space: nowrap;
    }
  `],
})
export class ReservationsComponent implements OnInit {
  readonly isAdmin = inject(RoleService).isAdmin;
  private readonly svc = inject(ReservationsService);
  private readonly t = inject(TranslateService);
  private readonly langSvc = inject(LanguageService);
  private readonly msg = inject(MessageService);

  readonly durations = [1, 2, 3, 4] as const;

  // ── Week strip state ──────────────────────────────────────────────────────
  private readonly _weekStart = signal(addDays(todayLocal(), -1));
  readonly weekStart = this._weekStart.asReadonly();
  readonly maxDate = computed(() => addDays(todayLocal(), MAX_AHEAD));
  readonly canGoNext = computed(() => addDays(this._weekStart(), 7) <= this.maxDate());

  // ── Booking selection state ───────────────────────────────────────────────
  readonly selectedDate = signal<Date | null>(null);
  readonly startHour = signal<number | null>(null);
  readonly endHour = signal<number | null>(null);

  // ── Slot data cache ───────────────────────────────────────────────────────
  readonly slotsMap = signal<Map<string, Slot[]>>(new Map());
  private readonly loadingKeys = signal<Set<string>>(new Set());
  readonly slotError = signal<string | null>(null);

  // ── Booking in-flight state ───────────────────────────────────────────────
  readonly booking = signal(false);
  readonly bookError = signal<string | null>(null);

  // ── View mode ─────────────────────────────────────────────────────────────
  readonly viewMode = signal<'timeline' | 'cards'>(
    (localStorage.getItem('harmonia-reservation-view') as 'timeline' | 'cards') ?? 'timeline'
  );
  readonly claimingSlot = signal<string>('');

  // ── Locale-aware computed helpers ─────────────────────────────────────────
  private readonly dayMins = computed(() => {
    const t = PRIMENG_TRANSLATIONS[this.langSvc.current()] as PrimTranslation;
    return t.dayNamesMin.map(s => s.toUpperCase());
  });

  private readonly dayNamesLong = computed(() => {
    const t = PRIMENG_TRANSLATIONS[this.langSvc.current()] as PrimTranslation;
    return t.dayNames;
  });

  private readonly monthNamesLong = computed(() => {
    const t = PRIMENG_TRANSLATIONS[this.langSvc.current()] as PrimTranslation;
    return t.monthNames;
  });

  // ── Visible 14-day strip ──────────────────────────────────────────────────
  readonly visibleDays = computed<DayCell[]>(() => {
    const ws = this.weekStart();
    const today = todayLocal();
    const todayStr = sofiaDateStr(today);
    const dayMins = this.dayMins();
    const sel = this.selectedDate();
    const selStr = sel ? sofiaDateStr(sel) : null;

    const max = this.maxDate();
    return Array.from({ length: STRIP_DAYS }, (_, i) => {
      const date = addDays(ws, i);
      const key = sofiaDateStr(date);
      return {
        date,
        abbr: dayMins[date.getDay()],
        num: date.getDate(),
        isPast: date < today || date > max,
        isToday: key === todayStr,
        isSelected: key === selStr,
        key,
      };
    });
  });

  // ── Month label for week navigation ──────────────────────────────────────
  readonly monthLabel = computed<string>(() => {
    const days = this.visibleDays();
    const mns = this.monthNamesLong();
    const first = days[0].date;
    const last = days[days.length - 1].date;
    const fm = mns[first.getMonth()];
    const lm = mns[last.getMonth()];
    const fy = first.getFullYear();
    const ly = last.getFullYear();
    if (first.getMonth() === last.getMonth() && fy === ly) return `${fm} ${fy}`;
    if (fy === ly) return `${fm} / ${lm} ${fy}`;
    return `${fm} ${fy} / ${lm} ${ly}`;
  });

  // ── Current day's slots ───────────────────────────────────────────────────
  private readonly currentSlots = computed(() => {
    const sel = this.selectedDate();
    if (!sel) return [];
    return this.slotsMap().get(sofiaDateStr(sel)) ?? [];
  });

  readonly loadingCurrent = computed(() => {
    const sel = this.selectedDate();
    if (!sel) return false;
    return this.loadingKeys().has(sofiaDateStr(sel));
  });

  // ── Hour cells for the timeline ───────────────────────────────────────────
  readonly hourCells = computed<HourCell[]>(() => {
    const slots = this.currentSlots();
    const startH = this.startHour();
    const endH = this.endHour();
    const sel = this.selectedDate();
    const isToday = sel ? sofiaDateStr(sel) === sofiaDateStr(todayLocal()) : false;
    const nowH = isToday ? sofiaHourNow() : -1;

    const hourSlot = new Map<number, Slot>();
    for (const s of slots) {
      const h = parseHour(s.slotKey);
      if (h >= H_START && h <= H_END) hourSlot.set(h, s);
    }

    return Array.from({ length: H_END - H_START + 1 }, (_, i) => {
      const hour = H_START + i;
      const slot = hourSlot.get(hour);

      let state: HourState = 'free';
      if (slot) {
        if (slot.state === 'taken-mine') state = 'mine';
        else if (slot.state !== 'free') state = 'occupied';
      }
      if (isToday && hour <= nowH) state = 'past';

      // Overlay selection (only on free hours)
      if (state === 'free') {
        if (startH !== null && endH !== null && hour >= startH && hour < endH) {
          state = hour === startH ? 'sel-start' : 'sel';
        } else if (startH !== null && endH === null && hour === startH) {
          state = 'sel-start';
        }
      }

      return { hour, slotKey: slot?.slotKey ?? String(hour), state };
    });
  });

  // ── Card-grid slots (raw state, no range overlay) ────────────────────────
  readonly cardSlots = computed(() => {
    const slots = this.currentSlots();
    const sel = this.selectedDate();
    const isToday = sel ? sofiaDateStr(sel) === sofiaDateStr(todayLocal()) : false;
    const nowH = isToday ? sofiaHourNow() : -1;
    return Array.from({ length: H_END - H_START + 1 }, (_, i) => {
      const hour = H_START + i;
      const slot = slots.find(s => parseHour(s.slotKey) === hour);
      return {
        hour,
        slotKey: slot?.slotKey ?? String(hour),
        state: slot?.state ?? 'free',
        isPast: isToday && hour <= nowH,
      };
    });
  });

  // ── Summary text ──────────────────────────────────────────────────────────
  readonly bookSummary = computed<string | null>(() => {
    const sel = this.selectedDate();
    const s = this.startHour();
    const e = this.endHour();
    if (!sel || s === null || e === null) return null;
    return `${fmtDate(sel)} · ${fmtHour(s)} – ${fmtHour(e)}`;
  });

  // ── Upcoming reservations ─────────────────────────────────────────────────
  readonly upcoming = computed<UpcomingEntry[]>(() => {
    const today = todayLocal();
    const dayNames = this.dayNamesLong();
    const entries: UpcomingEntry[] = [];

    this.slotsMap().forEach((slots, key) => {
      const [y, m, d] = key.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      if (date < today) return;

      const myHours = slots
        .filter(s => s.state === 'taken-mine')
        .map(s => parseHour(s.slotKey))
        .filter(h => h >= H_START && h <= H_END)
        .sort((a, b) => a - b);

      if (!myHours.length) return;

      let gs = myHours[0], ge = myHours[0] + 1;
      for (let i = 1; i < myHours.length; i++) {
        if (myHours[i] === ge) {
          ge++;
        } else {
          entries.push({ sortKey: key + fmtHour(gs), label: fmtDate(date), dayName: dayNames[date.getDay()], range: `${fmtHour(gs)} – ${fmtHour(ge)}` });
          gs = myHours[i]; ge = myHours[i] + 1;
        }
      }
      entries.push({ sortKey: key + fmtHour(gs), label: fmtDate(date), dayName: dayNames[date.getDay()], range: `${fmtHour(gs)} – ${fmtHour(ge)}` });
    });

    return entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    // No preload: slots are loaded on demand when the user selects a day.
    // The upcoming section populates as the user browses.
  }

  // ── Template predicates ───────────────────────────────────────────────────
  isDurActive(n: number): boolean {
    const s = this.startHour(), e = this.endHour();
    return s !== null && e !== null && (e - s) === n;
  }

  isEveningActive(): boolean {
    return this.startHour() === EVENING_START && this.endHour() === EVENING_END;
  }

  // ── User actions ──────────────────────────────────────────────────────────
  selectDay(day: DayCell): void {
    if (day.isPast) return;
    this.selectedDate.set(day.date);
    this.startHour.set(null);
    this.endHour.set(null);
    this.bookError.set(null);
    this.slotError.set(null);
    this.loadDay(day.key);
  }

  onHourTap(cell: HourCell): void {
    if (cell.state === 'occupied' || cell.state === 'past' || cell.state === 'mine') return;
    this.bookError.set(null);
    const s = this.startHour();

    if (s === null) {
      // First tap: immediately a 1-hour selection so the "1 ч" chip lights up.
      this.startHour.set(cell.hour);
      this.endHour.set(Math.min(cell.hour + 1, H_END + 1));
    } else if (cell.hour === s) {
      // Tap start again → deselect
      this.startHour.set(null);
      this.endHour.set(null);
    } else if (cell.hour < s) {
      // Tap before start → reset to new 1-hour selection.
      this.startHour.set(cell.hour);
      this.endHour.set(Math.min(cell.hour + 1, H_END + 1));
    } else {
      // Tap after start → tapped hour is the last SELECTED slot (inclusive),
      // so endHour is one past it (exclusive end used by the range logic).
      this.endHour.set(Math.min(cell.hour + 1, H_END + 1));
    }
  }

  setDuration(hours: number): void {
    const s = this.startHour();
    if (s === null) return;
    this.endHour.set(Math.min(s + hours, H_END + 1));
    this.bookError.set(null);
  }

  setWholeEvening(): void {
    this.startHour.set(EVENING_START);
    this.endHour.set(EVENING_END);
    this.bookError.set(null);
  }

  prevWeek(): void {
    const minStart = addDays(todayLocal(), -1);
    const prev = addDays(this._weekStart(), -7);
    this._weekStart.set(prev < minStart ? minStart : prev);
  }

  nextWeek(): void {
    if (!this.canGoNext()) return;
    this._weekStart.set(addDays(this._weekStart(), 7));
  }

  retryLoad(): void {
    const sel = this.selectedDate();
    if (sel) this.loadDay(sofiaDateStr(sel), true);
  }

  book(): void {
    const sel = this.selectedDate();
    const startH = this.startHour();
    const endH = this.endHour();
    if (!sel || startH === null || endH === null) return;

    const blocked = this.hourCells().filter(c => c.hour >= startH && c.hour < endH && c.state === 'occupied');
    if (blocked.length) {
      this.bookError.set(this.t.instant('reservation.errOccupied'));
      return;
    }

    const day = sofiaDateStr(sel);
    const rangeHours = this.hourCells().filter(c => c.hour >= startH && c.hour < endH);

    this.booking.set(true);
    this.bookError.set(null);

    const claims = rangeHours.map(c =>
      this.svc.claimSlot(day, c.slotKey).pipe(
        map(r => ({ slotKey: c.slotKey, outcome: r.outcome })),
        catchError(() => of({ slotKey: c.slotKey, outcome: 'network-error' as const })),
      )
    );

    forkJoin(claims).subscribe(results => {
      this.booking.set(false);
      const failed = results.filter(r => r.outcome !== 'confirmed-yours');

      if (!failed.length) {
        this.slotsMap.update(map => {
          const newMap = new Map(map);
          const daySlots = [...(newMap.get(day) ?? [])];
          for (const r of results) {
            const idx = daySlots.findIndex(s => s.slotKey === r.slotKey);
            if (idx >= 0) {
              daySlots[idx] = { ...daySlots[idx], state: 'taken-mine' };
            } else {
              daySlots.push({ slotKey: r.slotKey, state: 'taken-mine' });
            }
          }
          newMap.set(day, daySlots);
          return newMap;
        });
        this.startHour.set(null);
        this.endHour.set(null);
        this.msg.add({
          severity: 'success',
          summary: this.t.instant('reservation.bookingConfirmedSummary'),
          life: 3000,
        });
      } else if (failed.some(r => r.outcome === 'refused-already-taken')) {
        this.bookError.set(this.t.instant('reservation.errTaken'));
        this.loadDay(day, true);
      } else {
        this.bookError.set(this.t.instant('reservation.errNetwork'));
      }
    });
  }

  setViewMode(mode: 'timeline' | 'cards'): void {
    this.viewMode.set(mode);
    localStorage.setItem('harmonia-reservation-view', mode);
  }

  claimSingle(slotKey: string): void {
    const sel = this.selectedDate();
    if (!sel) return;
    const day = sofiaDateStr(sel);
    this.claimingSlot.set(slotKey);
    this.svc.claimSlot(day, slotKey).subscribe({
      next: r => {
        this.claimingSlot.set('');
        if (r.outcome === 'confirmed-yours') {
          this.slotsMap.update(map => {
            const newMap = new Map(map);
            const daySlots = [...(newMap.get(day) ?? [])];
            const idx = daySlots.findIndex(s => s.slotKey === slotKey);
            if (idx >= 0) daySlots[idx] = { ...daySlots[idx], state: 'taken-mine' };
            else daySlots.push({ slotKey, state: 'taken-mine' });
            newMap.set(day, daySlots);
            return newMap;
          });
          this.msg.add({ severity: 'success', summary: this.t.instant('reservation.bookingConfirmedSummary'), life: 3000 });
        } else if (r.outcome === 'refused-already-taken') {
          this.loadDay(day, true);
          this.msg.add({ severity: 'warn', summary: this.t.instant('reservation.slotTakenSummary'), life: 3000 });
        }
      },
      error: () => {
        this.claimingSlot.set('');
        this.msg.add({ severity: 'error', summary: this.t.instant('reservation.errNetwork'), life: 3000 });
      },
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────
  private loadDay(key: string, force = false): void {
    if (!force && this.slotsMap().has(key)) return;
    this.loadingKeys.update(s => new Set([...s, key]));
    this.slotError.set(null);
    this.svc.getSlots(key).subscribe({
      next: r => {
        this.slotsMap.update(m => new Map([...m, [key, r.slots]]));
        this.loadingKeys.update(s => { const n = new Set(s); n.delete(key); return n; });
      },
      error: () => {
        this.loadingKeys.update(s => { const n = new Set(s); n.delete(key); return n; });
        this.slotError.set(this.t.instant('reservation.errLoad'));
      },
    });
  }
}
