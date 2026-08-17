import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CounterpartyService } from '../counterparties/counterparty.service';
import { Counterparty } from '../counterparties/counterparty.models';

@Component({
  selector: 'app-counterparty-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, TranslatePipe],
  template: `
    <p-select
      [options]="options"
      [(ngModel)]="selectedId"
      (onChange)="onSelect()"
      optionLabel="label" optionValue="value"
      [filter]="true"
      [placeholder]="'finance.counterpartyLabel' | translate"
      styleClass="w-full"
    />
    @if (selected) {
      <div class="picker-caption">{{ selected.category }} / {{ selected.parentCategory }}</div>
    }
  `,
  styles: [`
    .picker-caption { font-size: 0.8125rem; color: var(--p-text-muted-color); margin-top: 0.25rem; }
    .w-full { width: 100%; }
  `],
})
export class CounterpartyPickerComponent implements OnInit {
  private readonly svc = inject(CounterpartyService);
  readonly t = inject(TranslateService);

  @Output() counterpartyChange = new EventEmitter<Counterparty | null>();

  counterparties: Counterparty[] = [];
  options: { label: string; value: string }[] = [];
  selectedId: string | null = null;
  selected: Counterparty | null = null;

  ngOnInit(): void {
    this.svc.list().subscribe(list => {
      this.counterparties = list;
      this.options = list.map(c => ({ label: `${c.name} (${c.category})`, value: c.id }));
    });
  }

  onSelect(): void {
    this.selected = this.counterparties.find(c => c.id === this.selectedId) ?? null;
    this.counterpartyChange.emit(this.selected);
  }
}
