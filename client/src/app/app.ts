import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly http = inject(HttpClient);
  readonly Math = Math;
  readonly categories = signal<any[]>([]);
  readonly templates = signal<any[]>([]);
  readonly selectedCategory = signal<any | null>(null);
  readonly selectedTemplate = signal<any | null>(null);
  readonly page = signal<'home' | 'gallery' | 'editor' | 'admin-login' | 'admin'>('home');
  readonly loading = signal(false);
  readonly notice = signal('');
  readonly adminCategories = signal<any[]>([]);
  readonly adminTemplates = signal<any[]>([]);
  search = '';
  galleryPage = 0;
  message = '';
  textColor = '#ffffff';
  textSize = 46;
  textAlign: CanvasTextAlign = 'center';
  textPosition = 620;
  login = { username: 'admin', password: 'admin123' };
  token = sessionStorage.getItem('ecard-admin-token') || '';
  categoryForm = { name: '', slug: '', description: '', sortOrder: 0, isPublished: true };
  email = '';
  uploadForm = { categoryId: '', title: '', altText: '', licenseSource: 'Original eCard artwork', licenseType: 'Original', attributionText: '© eCard', reuseConfirmed: false };
  selectedFile?: File;

  ngOnInit() { this.loadCategories(); }

  loadCategories() {
    this.loading.set(true);
    this.http.get<any[]>('/api/categories').subscribe({
      next: data => { this.categories.set(data); this.loading.set(false); },
      error: () => { this.notice.set('Could not load categories. Start the API server and try again.'); this.loading.set(false); }
    });
  }

  filteredCategories() {
    const value = this.search.trim().toLowerCase();
    return value ? this.categories().filter(c => c.name.toLowerCase().includes(value)) : this.categories();
  }

  openCategory(category: any) {
    this.loading.set(true);
    this.http.get<any>(`/api/categories/${category.slug}/templates`).subscribe({
      next: data => { this.selectedCategory.set(data.category); this.templates.set(data.templates); this.galleryPage = 0; this.page.set('gallery'); this.loading.set(false); },
      error: () => { this.notice.set('Templates could not be loaded.'); this.loading.set(false); }
    });
  }

  isGanesh() { return this.matchesTheme('ganesh'); }
  isDiwali() { return this.matchesTheme('diwali'); }
  isBirthday() { return this.matchesTheme('birthday'); }
  private matchesTheme(word: string) {
    const slug = this.selectedCategory()?.slug || '';
    const name = this.selectedCategory()?.name || '';
    return slug.includes(word) || name.toLowerCase().includes(word);
  }
  coverFor(category: any) {
    const slug = category?.slug || '';
    const name = (category?.name || '').toLowerCase();
    if (slug.includes('ganesh') || name.includes('ganesh')) return '/covers/cover-ganesh.png';
    if (slug.includes('diwali') || name.includes('diwali')) return '/covers/cover-diwali.png';
    if (slug.includes('birthday') || name.includes('birthday')) return '/covers/cover-birthday.png';
    return '/covers/home-hero.png';
  }
  visibleTemplates() { return this.templates().slice(this.galleryPage * 3, this.galleryPage * 3 + 3); }
  nextTemplates() { if ((this.galleryPage + 1) * 3 < this.templates().length) this.galleryPage++; }
  previousTemplates() { if (this.galleryPage) this.galleryPage--; }
  chooseTemplate(template: any) { this.selectedTemplate.set(template); this.page.set('editor'); }
  messageTop() {
    if (this.textPosition <= 300) return 16;
    if (this.textPosition <= 500) return 46;
    return 78;
  }
  previewFont() { return Math.round(this.textSize * 0.72); }

  private composeCard() {
    return new Promise<HTMLCanvasElement>((resolve, reject) => {
      const template = this.selectedTemplate();
      if (!template) return reject(new Error('No template selected.'));
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const width = image.naturalWidth || 1200;
        const height = image.naturalHeight || 800;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Preview could not be created.'));
        ctx.drawImage(image, 0, 0, width, height);
        const fontSize = Math.round(this.textSize * (Math.min(width, height) / 800));
        ctx.font = `600 ${fontSize}px Arial`;
        ctx.fillStyle = this.textColor;
        ctx.textAlign = this.textAlign;
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0,0,0,.45)';
        ctx.shadowBlur = 8;
        const x = this.textAlign === 'left' ? width * 0.08 : this.textAlign === 'right' ? width * 0.92 : width / 2;
        const lines = this.wrapText(ctx, this.message || 'Your message here', width * 0.84);
        const start = height * (this.messageTop() / 100);
        lines.forEach((line, index) => ctx.fillText(line, x, start + index * fontSize * 1.25));
        resolve(canvas);
      };
      image.onerror = () => reject(new Error('The selected image could not be loaded.'));
      image.src = template.image_url;
    });
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, max: number) {
    const words = text.split(/\s+/); const lines: string[] = []; let line = '';
    for (const word of words) { const test = `${line} ${word}`.trim(); if (ctx.measureText(test).width > max && line) { lines.push(line); line = word; } else line = test; }
    return [...lines, line].filter(Boolean);
  }

  async download() {
    try {
      const canvas = await this.composeCard();
      const link = document.createElement('a');
      link.download = 'ecard.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error: any) {
      this.notice.set(error.message || 'The card could not be downloaded.');
    }
  }
  async shareWhatsApp() {
    try {
      const canvas = await this.composeCard();
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = blob ? new File([blob], 'ecard.png', { type: 'image/png' }) : null;
      if (file && navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: 'eCard', files: [file] });
      else { await this.download(); window.open('https://wa.me/?text=I%20made%20an%20eCard!', '_blank'); }
    } catch (error: any) {
      this.notice.set(error.message || 'The card could not be shared.');
    }
  }
  async sendEmail() {
    try {
      const canvas = await this.composeCard();
      this.http.post<any>('/api/share/email', { email: this.email, imageData: canvas.toDataURL('image/png') }).subscribe({
        next: result => this.notice.set(result.message),
        error: err => this.notice.set(err.error?.message || 'Email could not be sent.')
      });
    } catch (error: any) {
      this.notice.set(error.message || 'The card could not be sent.');
    }
  }

  openAdmin() { this.page.set(this.token ? 'admin' : 'admin-login'); if (this.token) this.loadAdmin(); }
  signIn() {
    this.http.post<any>('/api/auth/login', this.login).subscribe({
      next: result => { this.token = result.token; sessionStorage.setItem('ecard-admin-token', result.token); this.page.set('admin'); this.loadAdmin(); },
      error: err => this.notice.set(err.error?.message || 'Login failed.')
    });
  }
  logout() { sessionStorage.removeItem('ecard-admin-token'); this.token = ''; this.page.set('home'); }
  private headers() { return { headers: new HttpHeaders({ Authorization: `Bearer ${this.token}` }) }; }
  loadAdmin() {
    this.http.get<any[]>('/api/admin/categories', this.headers()).subscribe(data => this.adminCategories.set(data));
    this.http.get<any[]>('/api/admin/templates', this.headers()).subscribe(data => this.adminTemplates.set(data));
  }
  addCategory() {
    if (!this.categoryForm.name || !this.categoryForm.slug) return;
    this.http.post('/api/admin/categories', this.categoryForm, this.headers()).subscribe({
      next: () => { this.categoryForm = { name: '', slug: '', description: '', sortOrder: 0, isPublished: true }; this.loadAdmin(); this.loadCategories(); },
      error: err => this.notice.set(err.error?.message || 'Category could not be saved.')
    });
  }
  deleteCategory(id: number) { if (confirm('Delete this category and its templates?')) this.http.delete(`/api/admin/categories/${id}`, this.headers()).subscribe(() => { this.loadAdmin(); this.loadCategories(); }); }
  onFile(event: Event) { this.selectedFile = (event.target as HTMLInputElement).files?.[0]; }
  uploadTemplate() {
    if (!this.selectedFile || !this.uploadForm.categoryId || !this.uploadForm.reuseConfirmed) { this.notice.set('Choose an image, category and confirm its free-use license.'); return; }
    const body = new FormData(); Object.entries(this.uploadForm).forEach(([key, value]) => body.append(key, String(value))); body.append('image', this.selectedFile);
    this.http.post('/api/admin/templates', body, this.headers()).subscribe({
      next: () => { this.notice.set('Template uploaded.'); this.loadAdmin(); },
      error: err => this.notice.set(err.error?.message || 'Upload failed.')
    });
  }
  deleteTemplate(id: number) { if (confirm('Delete this template?')) this.http.delete(`/api/admin/templates/${id}`, this.headers()).subscribe(() => this.loadAdmin()); }
}
