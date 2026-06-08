import { ChangeDetectionStrategy, Component, computed, inject, signal, NgZone, PLATFORM_ID } from '@angular/core';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroAdjustmentsHorizontal,
  heroCheckCircle,
  heroChevronLeft,
  heroChartBar,
  heroFire,
  heroMagnifyingGlass,
  heroPencilSquare,
  heroPlus,
  heroQrCode,
  heroTrash,
  heroXMark,
} from '@ng-icons/heroicons/outline';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { format } from 'date-fns';
import type { FoodItem, MealType } from '../../models/nutrition.model';
import { NutritionService } from '../../services/nutrition.service';


// Declare minimal BarcodeDetector types (Chrome/Edge on Android/macOS only)
declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}

@Component({
  selector: 'app-calories',
  imports: [NgIconComponent, NgxEchartsDirective, FormsModule, DecimalPipe, RouterLink],
  providers: [provideIcons({ heroFire, heroMagnifyingGlass, heroPlus, heroTrash, heroXMark, heroCheckCircle, heroAdjustmentsHorizontal, heroQrCode, heroChevronLeft, heroPencilSquare, heroChartBar })],
  templateUrl: './calories.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col overflow-hidden min-w-0' },
})
export class Calories {
  protected readonly showUnderConstruction = false;
  protected readonly nutritionService = inject(NutritionService);
  protected readonly today = format(new Date(), 'EEEE, MMMM d');

  // Toast notification
  protected readonly toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  private showToast(message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set(message);
    this.toastTimer = setTimeout(() => this.toast.set(null), 3000);
  }

  // Food logging state
  protected readonly addingTo = signal<MealType | null>(null);
  protected readonly addMode = signal<'select' | 'search' | 'scan' | 'custom'>('select');
  protected readonly servings = signal(1);
  protected readonly searchQuery = signal('');
  protected readonly selectedFood = signal<FoodItem | null>(null);
  protected readonly selectedMealType = signal<MealType>('log');
  protected readonly mealTypes: { value: MealType; label: string }[] = [
    { value: 'breakfast', label: 'Breakfast' },
    { value: 'lunch', label: 'Lunch' },
    { value: 'dinner', label: 'Dinner' },
    { value: 'snack', label: 'Snack' },
  ];

  // Custom food form state
  protected readonly customFood = signal({
    name: '', brand: '', calories: 0, protein: 0, carbs: 0, fat: 0,
    servingSize: 100, servingUnit: 'g',
  });


  // Barcode scanner state
  protected readonly showBarcodeScanner = signal(false);
  protected readonly scanError = signal<string | null>(null);
  protected readonly scanLoading = signal(false);
  protected readonly scanState = signal<'scanning' | 'found'>('scanning');
  protected readonly frozenFrame = signal<string | null>(null);
  // Always supported — native BarcodeDetector where available, zxing fallback everywhere else
  protected readonly barcodeSupported = true;

  private readonly zone = inject(NgZone);
  private videoStream: MediaStream | null = null;
  private detectionInterval: ReturnType<typeof setInterval> | null = null;
  private zxingReader: BrowserMultiFormatReader | null = null;
  private zxingControls: { stop: () => void } | null = null;

  protected readonly totals = this.nutritionService.todayTotals;
  protected readonly goals = this.nutritionService.goals;
  protected readonly todayLog = this.nutritionService.todayLog;
  protected readonly searchResults = this.nutritionService.searchResults;

  protected readonly caloriePercent = computed(() => {
    const g = this.goals().calories;
    return g > 0 ? Math.min(100, (this.totals().calories / g) * 100) : 0;
  });

  protected readonly remaining = computed(() => Math.max(0, this.goals().calories - this.totals().calories));

  protected readonly macros = computed(() => {
    const g = this.goals();
    const t = this.totals();
    return [
      { name: 'Protein', value: Math.round(t.protein), goal: g.protein, unit: 'g', color: '#ff7759', pct: g.protein > 0 ? Math.min(100, (t.protein / g.protein) * 100) : 0 },
      { name: 'Carbs', value: Math.round(t.carbs), goal: g.carbs, unit: 'g', color: '#fbbf24', pct: g.carbs > 0 ? Math.min(100, (t.carbs / g.carbs) * 100) : 0 },
      { name: 'Fat', value: Math.round(t.fat), goal: g.fat, unit: 'g', color: '#60a5fa', pct: g.fat > 0 ? Math.min(100, (t.fat / g.fat) * 100) : 0 },
    ];
  });

  protected readonly donutOption = computed<EChartsOption>(() => {
    const pct = this.caloriePercent();
    return {
      series: [{
        type: 'gauge',
        startAngle: 90,
        endAngle: -270,
        radius: '100%',
        pointer: { show: false },
        progress: { show: true, overlap: false, roundCap: true, clip: false, itemStyle: { color: '#ff7759' } },
        axisLine: { lineStyle: { width: 12, color: [[1, '#f2f2f2']] } },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        data: [{ value: Math.round(pct), name: '' }],
        detail: { show: false },
        title: { show: false },
      }],
    };
  });

  protected readonly weeklyChartOption = computed<EChartsOption>(() => {
    const weekly = this.nutritionService.weeklyCalories();
    const goal = this.goals().calories;
    return {
      grid: { top: 16, right: 48, bottom: 24, left: 8, containLabel: false },
      xAxis: {
        type: 'category',
        data: weekly.map((d) => d.label),
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { fontSize: 11, color: '#93939f', fontFamily: 'Inter, sans-serif' },
      },
      yAxis: { type: 'value', show: false, max: Math.max(goal * 1.15, 2800) },
      series: [{
        type: 'bar', barMaxWidth: 28,
        data: weekly.map((d) => ({
          value: d.calories || null,
          itemStyle: {
            color: format(d.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? '#ff7759' : 'rgba(255,119,89,0.25)',
            borderRadius: [4, 4, 0, 0],
          },
        })),
        markLine: {
          silent: true, symbol: 'none',
          data: [{ yAxis: goal }],
          lineStyle: { color: '#d9d9dd', type: 'dashed', width: 1 },
          label: { formatter: `${goal.toLocaleString()} kcal`, position: 'end', color: '#93939f', fontSize: 10, fontFamily: 'Inter, sans-serif' },
        },
      }],
      tooltip: {
        trigger: 'axis',
        formatter: (p: any) => { const d = Array.isArray(p) ? p[0] : p; return d?.value ? `${d.name}: <strong>${Number(d.value).toLocaleString()} kcal</strong>` : ''; },
        backgroundColor: '#17171c', borderColor: 'transparent',
        textStyle: { color: '#fff', fontSize: 12, fontFamily: 'Inter, sans-serif' },
      },
    };
  });

  // ── Food search ──────────────────────────────────────────────────

  openAddModal(): void {
    this.addingTo.set('log');
    this.addMode.set('select');
    this.searchQuery.set('');
    this.selectedFood.set(null);
    this.servings.set(1);
    this.selectedMealType.set('log');
    this.customFood.set({ name: '', brand: '', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: 100, servingUnit: 'g' });
  }

  closeAddModal(): void {
    this.addingTo.set(null);
    this.addMode.set('select');
    this.selectedFood.set(null);
    this.stopCamera();
    this.showBarcodeScanner.set(false);
    this.scanError.set(null);
  }

  openSearch(): void {
    this.addingTo.set('log');
    this.addMode.set('search');
    this.searchQuery.set('');
    this.selectedFood.set(null);
    this.servings.set(1);
    this.nutritionService.search('');
  }

  closeSearch(): void {
    this.addMode.set('select');
    this.selectedFood.set(null);
  }

  updateCustomFood(field: string, value: string | number): void {
    this.customFood.update((f) => ({ ...f, [field]: value }));
  }

  addCustomFood(): void {
    const c = this.customFood();
    if (!c.name.trim()) return;
    const food: FoodItem = {
      id: `custom-${Date.now()}`,
      name: c.name.trim(),
      brand: c.brand.trim() || undefined,
      servingSize: c.servingSize || 100,
      servingUnit: c.servingUnit || 'g',
      calories: c.calories,
      protein: c.protein,
      carbs: c.carbs,
      fat: c.fat,
      source: 'custom',
    };
    this.nutritionService.addEntry(food, 1, this.selectedMealType());
    this.closeAddModal();
  }

  onSearch(q: string): void {
    this.searchQuery.set(q);
    this.nutritionService.search(q);
  }

  selectFood(food: FoodItem): void {
    this.selectedFood.set(food);
    this.servings.set(1);
  }

  confirmAdd(): void {
    const food = this.selectedFood();
    if (!food) return;
    this.nutritionService.addEntry(food, this.servings(), this.selectedMealType());
    this.showToast(`${food.name} logged`);
    this.selectedFood.set(null);
    this.searchQuery.set('');
    this.nutritionService.search('');
  }

  removeEntry(id: string): void {
    this.nutritionService.removeEntry(id);
  }

  protected readonly previewCalories = computed(() => {
    const food = this.selectedFood();
    return food ? Math.round(food.calories * this.servings()) : 0;
  });

  decreaseServings(): void {
    this.servings.update((s) => (s > 0.5 ? +(s - 0.5).toFixed(1) : 0.5));
  }

  increaseServings(): void {
    this.servings.update((s) => +(s + 0.5).toFixed(1));
  }


  // ── Barcode scanner ───────────────────────────────────────────────

  async openScanner(): Promise<void> {
    this.addingTo.set('log');
    await this.startScan();
  }

  async startScan(): Promise<void> {
    this.scanError.set(null);
    this.scanState.set('scanning');
    this.frozenFrame.set(null);
    this.addMode.set('scan');
    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
      });
      this.showBarcodeScanner.set(true);
      setTimeout(() => this.attachStreamToVideo(), 50);
    } catch {
      this.scanError.set('Camera access was denied. Please allow camera access and try again.');
      this.addMode.set('select');
    }
  }

  private attachStreamToVideo(): void {
    const video = document.querySelector('[data-scanner-video]') as HTMLVideoElement | null;
    if (!video || !this.videoStream) return;
    video.srcObject = this.videoStream;
    video.play().catch(() => {});

    // Wait for video to be ready before starting detection
    const startDetection = () => {
      if ('BarcodeDetector' in window) {
        this.startNativeDetection(video);
      } else {
        this.startZxingDetection(video);
      }
    };

    if (video.readyState >= 2) {
      startDetection();
    } else {
      video.addEventListener('canplay', startDetection, { once: true });
    }
  }

  private captureFrame(video: HTMLVideoElement): string | null {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || video.clientWidth;
      canvas.height = video.videoHeight || video.clientHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch {
      return null;
    }
  }

  /** Native BarcodeDetector — Chrome on Android/macOS */
  private startNativeDetection(video: HTMLVideoElement): void {
    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] });
    this.detectionInterval = setInterval(async () => {
      if (video.readyState < 2) return;
      try {
        const found = await detector.detect(video);
        if (found.length > 0) {
          const frame = this.captureFrame(video);
          this.zone.run(() => {
            this.frozenFrame.set(frame);
            this.scanState.set('found');
          });
          this.stopCamera();
          await this.lookupBarcode(found[0].rawValue);
        }
      } catch { /* ignore frame errors */ }
    }, 400);
  }

  /** zxing fallback — Chrome/Firefox on Windows/Linux */
  private startZxingDetection(video: HTMLVideoElement): void {
    this.zxingReader = new BrowserMultiFormatReader();
    this.zxingReader.decodeFromStream(this.videoStream!, video, (result, _err, controls) => {
      if (!result) return;
      const frame = this.captureFrame(video);
      this.zone.run(async () => {
        this.frozenFrame.set(frame);
        this.scanState.set('found');
        this.zxingControls = null;
        controls.stop();
        this.stopCamera();
        await this.lookupBarcode(result.getText());
      });
    }).then((controls) => {
      this.zxingControls = controls;
    }).catch(() => {});
  }

  stopScanner(): void {
    this.stopCamera();
    this.showBarcodeScanner.set(false);
    this.scanError.set(null);
    this.addMode.set('select');
  }

  private stopCamera(): void {
    if (this.detectionInterval !== null) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
    if (this.zxingControls) {
      this.zxingControls.stop();
      this.zxingControls = null;
    }
    this.zxingReader = null;
    this.videoStream?.getTracks().forEach((t) => t.stop());
    this.videoStream = null;
  }

  private async lookupBarcode(barcode: string): Promise<void> {
    // This runs exclusively in the browser (triggered by camera detection — never SSR).
    // Fetch goes directly from the client to Open Food Facts — no server proxy.
    // Normalize UPC-A (12 digits) → EAN-13 by prepending 0 (OFF stores them this way)
    const normalized = barcode.length === 12 ? `0${barcode}` : barcode;
    barcode = normalized;
    this.scanLoading.set(true);
    this.scanError.set(null);
    // Keep showBarcodeScanner true so frozen frame stays visible during lookup
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v3/product/${barcode}?fields=product_name,generic_name,brands,serving_quantity,serving_size,nutriments`,
        { headers: { 'User-Agent': 'ilook.hot/0.0.9 (https://github.com/nishi7409/ilook.hot)' } },
      );
      const data = await res.json();
      if (data.status !== 'success' || !data.product) {
        this.showBarcodeScanner.set(false);
        this.scanError.set(`Product not found (${barcode}). Try searching manually.`);
        // Stay in scan mode so the error message is visible
        return;
      }
      const p = data.product;
      const n = p.nutriments ?? {};
      // Prefer per-serving values, fall back to per-100g
      const food: FoodItem = {
        id: `barcode-${barcode}`,
        name: p.product_name || p.generic_name || 'Unknown product',
        brand: p.brands?.split(',')[0].trim() || undefined,
        servingSize: parseFloat(p.serving_quantity) || 100,
        servingUnit: p.serving_size || '100g',
        calories: Math.round(n['energy-kcal_serving'] ?? n['energy-kcal_100g'] ?? n['energy_kcal'] ?? 0),
        protein: +(n['proteins_serving'] ?? n['proteins_100g'] ?? 0).toFixed(1),
        carbs: +(n['carbohydrates_serving'] ?? n['carbohydrates_100g'] ?? 0).toFixed(1),
        fat: +(n['fat_serving'] ?? n['fat_100g'] ?? 0).toFixed(1),
        source: 'openfoodfacts',
      };
      // Auto-log with 1 serving — no extra tap needed after scanning
      this.nutritionService.addEntry(food, 1, this.selectedMealType());
      this.showToast(`${food.name} logged`);
      this.closeAddModal();
    } catch {
      this.showBarcodeScanner.set(false);
      this.scanError.set('Could not look up product. Check your connection.');
      // Stay in scan mode so the error is visible
    } finally {
      this.scanLoading.set(false);
    }
  }

  // ── Nutrition History Charts ────────────────────────────────────
  protected readonly historyPeriod = signal(30);
  protected readonly historyPeriods = [
    { days: 7, label: '7d' },
    { days: 30, label: '30d' },
    { days: 90, label: '90d' },
  ];

  protected readonly historyData = this.nutritionService.history;
  protected readonly historyLoading = this.nutritionService.historyLoading;

  protected readonly historyAverages = computed(() => {
    const data = this.historyData();
    const logged = data.filter((d) => d.calories > 0);
    if (logged.length === 0) return { calories: 0, protein: 0, carbs: 0, fat: 0, daysLogged: 0 };
    const sum = logged.reduce(
      (a, d) => ({ calories: a.calories + d.calories, protein: a.protein + d.protein, carbs: a.carbs + d.carbs, fat: a.fat + d.fat }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    return {
      calories: Math.round(sum.calories / logged.length),
      protein: Math.round(sum.protein / logged.length),
      carbs: Math.round(sum.carbs / logged.length),
      fat: Math.round(sum.fat / logged.length),
      daysLogged: logged.length,
    };
  });

  protected readonly proteinStreak = computed(() => {
    const data = this.historyData();
    const goal = this.goals().protein;
    let streak = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].protein >= goal) streak++;
      else break;
    }
    return streak;
  });

  protected readonly calorieTrendOption = computed<EChartsOption>(() => {
    const data = this.historyData();
    const goal = this.goals().calories;
    return {
      grid: { top: 24, right: 16, bottom: 24, left: 48 },
      xAxis: {
        type: 'category',
        data: data.map((d) => d.date.slice(5)),
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { fontSize: 10, color: '#93939f', fontFamily: 'Inter, sans-serif', interval: Math.max(0, Math.floor(data.length / 8) - 1) },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#93939f', fontFamily: 'Inter, sans-serif' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series: [{
        type: 'line', smooth: true, symbol: 'none',
        data: data.map((d) => d.calories || null),
        lineStyle: { color: '#ff7759', width: 2 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(255,119,89,0.25)' }, { offset: 1, color: 'rgba(255,119,89,0)' }] } },
        markLine: {
          silent: true, symbol: 'none',
          data: [{ yAxis: goal }],
          lineStyle: { color: '#d9d9dd', type: 'dashed', width: 1 },
          label: { formatter: `${goal.toLocaleString()} kcal`, position: 'end', color: '#93939f', fontSize: 10 },
        },
      }],
      tooltip: {
        trigger: 'axis',
        formatter: (p: unknown) => { const d = Array.isArray(p) ? p[0] : p; const r = d as Record<string, unknown>; return r?.['value'] ? `${r['name']}: <strong>${Number(r['value']).toLocaleString()} kcal</strong>` : ''; },
        backgroundColor: '#17171c', borderColor: 'transparent',
        textStyle: { color: '#fff', fontSize: 12, fontFamily: 'Inter, sans-serif' },
      },
    };
  });

  protected readonly macroTrendOption = computed<EChartsOption>(() => {
    const data = this.historyData();
    const makeSeries = (key: 'protein' | 'carbs' | 'fat', color: string, label: string) => ({
      name: label, type: 'line' as const, smooth: true, symbol: 'none', stack: 'macros',
      data: data.map((d) => d[key] || null),
      lineStyle: { width: 0 },
      areaStyle: { color },
    });
    return {
      grid: { top: 32, right: 16, bottom: 24, left: 48 },
      legend: { top: 0, textStyle: { color: '#93939f', fontSize: 11, fontFamily: 'Inter, sans-serif' } },
      xAxis: {
        type: 'category',
        data: data.map((d) => d.date.slice(5)),
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { fontSize: 10, color: '#93939f', fontFamily: 'Inter, sans-serif', interval: Math.max(0, Math.floor(data.length / 8) - 1) },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#93939f', fontFamily: 'Inter, sans-serif', formatter: '{value}g' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series: [
        makeSeries('protein', 'rgba(255,119,89,0.5)', 'Protein'),
        makeSeries('carbs', 'rgba(251,191,36,0.4)', 'Carbs'),
        makeSeries('fat', 'rgba(96,165,250,0.4)', 'Fat'),
      ],
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#17171c', borderColor: 'transparent',
        textStyle: { color: '#fff', fontSize: 12, fontFamily: 'Inter, sans-serif' },
      },
    };
  });

  selectHistoryPeriod(days: number): void {
    this.historyPeriod.set(days);
    this.nutritionService.loadHistory(days);
  }

  constructor() {
    // Load 30-day history by default (only in browser)
    const platformId = inject(PLATFORM_ID);
    if (isPlatformBrowser(platformId)) {
      this.nutritionService.loadHistory(30);
    }
  }
}
