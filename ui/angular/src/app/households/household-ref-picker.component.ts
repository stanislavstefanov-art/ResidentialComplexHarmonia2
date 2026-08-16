import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TranslatePipe } from '@ngx-translate/core';

type Building = 'X3' | 'X4' | '';
interface ApartmentRow { building: Building; number: number; }

const APTS: Record<'X3' | 'X4', number[]> = {
  X3: Array.from({ length: 19 }, (_, i) => i + 1),
  X4: Array.from({ length: 16 }, (_, i) => i + 1),
};

function buildRef(rows: ApartmentRow[]): string {
  const valid = rows.filter(r => r.building !== '' && r.number !== 0);
  if (valid.length === 0) return '';
  const grouped = new Map<'X3' | 'X4', number[]>();
  [...valid]
    .sort((a, b) => a.building.localeCompare(b.building) || a.number - b.number)
    .forEach(r => {
      const b = r.building as 'X3' | 'X4';
      const nums = grouped.get(b) ?? [];
      nums.push(r.number);
      grouped.set(b, nums);
    });
  return Array.from(grouped.entries())
    .map(([b, nums]) => `${b} АП${nums.join('/')}`)
    .join(' / ');
}

@Component({
  selector: 'app-household-ref-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, ButtonModule, TranslatePipe],
  template: `
    @for (row of rows; track $index) {
      <div class="picker-row">
        <p-select
          [options]="buildingOptions"
          [(ngModel)]="row.building"
          (onChange)="onBuildingChange($index, row.building)"
          optionLabel="label" optionValue="value"
          [placeholder]="'households.building' | translate"
          styleClass="building-select"
        />
        <p-select
          [options]="apartmentOptions(row.building)"
          [(ngModel)]="row.number"
          (onChange)="emit()"
          optionLabel="label" optionValue="value"
          [disabled]="!row.building"
          [placeholder]="'households.apartment' | translate"
          styleClass="apartment-select"
        />
        @if (rows.length > 1) {
          <p-button icon="pi pi-times" [text]="true" [rounded]="true" size="small" (onClick)="removeRow($index)" />
        }
        @if ($index === 0 && ref()) {
          <span class="ref-preview">{{ ref() }}</span>
        }
      </div>
    }
    <p-button icon="pi pi-plus" [text]="true" size="small" (onClick)="addRow()" [label]="'households.addApartment' | translate" />
  `,
  styles: [`
    .picker-row { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; }
    .ref-preview { font-family: monospace; color: var(--p-text-muted-color); margin-left: 0.5rem; }
  `],
})
export class HouseholdRefPickerComponent {
  @Output() refChange = new EventEmitter<string>();

  rows: ApartmentRow[] = [{ building: '', number: 0 }];
  buildingOptions = [{ label: '—', value: '' }, { label: 'X3', value: 'X3' }, { label: 'X4', value: 'X4' }];

  apartmentOptions(building: Building) {
    if (!building) return [{ label: '—', value: 0 }];
    return [{ label: '—', value: 0 }, ...APTS[building].map(n => ({ label: `АП${n}`, value: n }))];
  }

  onBuildingChange(idx: number, building: Building) {
    this.rows[idx] = { building, number: 0 };
    this.emit();
  }

  addRow() {
    this.rows = [...this.rows, { building: '', number: 0 }];
  }

  removeRow(idx: number) {
    if (this.rows.length === 1) return;
    this.rows = this.rows.filter((_, i) => i !== idx);
    this.emit();
  }

  ref() {
    return buildRef(this.rows);
  }

  emit() {
    this.refChange.emit(this.ref());
  }
}
