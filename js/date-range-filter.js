/**
 * DATE RANGE FILTER ENHANCEMENT
  * Menambahkan fitur date range picker untuk dashboard
   * Tidak mengubah API connection dan Cloudflare
    */

class DateRangeFilter {
    constructor() {
          this.startDate = null;
          this.endDate = null;
          this.isActive = false;
    }

    /**
       * Initialize date range filter UI
          * Inject ke halaman setelah dashboard loaded
             */
    init() {
          // Tunggu sampai DATA array ada (loaded dari app.js)
          if (typeof DATA === 'undefined') {
                  setTimeout(() => this.init(), 500);
                  return;
          }

          this.createFilterUI();
          this.attachEventListeners();
    }

    /**
       * Create HTML untuk date range picker
          */
    createFilterUI() {
          const sarsingSection = document.querySelector('.saring');
          if (!sarsingSection) return;

          // Buat container untuk date range picker
          const dateRangeHTML = `
                  <div class="date-range-picker">
                    <div class="date-range-field">
                      <label for="dateRangeStart">Dari Tanggal</label>
                      <input type="date" id="dateRangeStart" class="date-start">
                    </div>
                    <div class="date-range-field">
                      <label for="dateRangeEnd">Sampai Tanggal</label>
                      <input type="date" id="dateRangeEnd" class="date-end">
                    </div>
                    <div class="date-range-actions">
                      <button class="btn-date-apply" id="btnApplyDateRange">Terapkan</button>
                      <button class="btn-date-reset" id="btnResetDateRange">Reset</button>
                    </div>
                    <div class="date-range-info" id="dateRangeInfo" style="display: none;"></div>
                  </div>
                `;

                // Insert sebelum filter lainnya
                sarsingSection.insertAdjacentHTML('beforebegin', dateRangeHTML);
            }

    /**
       * Attach event listeners untuk buttons dan inputs
          */
    attachEventListeners() {
          const btnApply = document.getElementById('btnApplyDateRange');
          const btnReset = document.getElementById('btnResetDateRange');
          const inputStart = document.getElementById('dateRangeStart');
          const inputEnd = document.getElementById('dateRangeEnd');

          if (btnApply) {
                  btnApply.addEventListener('click', () => this.applyFilter());
          }

          if (btnReset) {
                  btnReset.addEventListener('click', () => this.resetFilter());
          }

          // Real-time feedback saat input berubah
          if (inputStart) {
                  inputStart.addEventListener('change', () => this.updateInfo());
          }

          if (inputEnd) {
                  inputEnd.addEventListener('change', () => this.updateInfo());
          }
    }

    /**
       * Parse tanggal dari format input
          */
    parseDate(dateString) {
          if (!dateString) return null;
          return new Date(dateString + 'T00:00:00');
    }

    /**
       * Extract tanggal dari string format "DD/MM/YYYY"
          */
    extractDate(dateStr) {
          if (!dateStr) return null;
          const parts = dateStr.split('/');
          if (parts.length !== 3) return null;
          return new Date(parts[2], parseInt(parts[1]) - 1, parts[0]);
    }

    /**
       * Aplikasikan filter berdasarkan date range
          */
    applyFilter() {
          const inputStart = document.getElementById('dateRangeStart');
          const inputEnd = document.getElementById('dateRangeEnd');

          if (!inputStart || !inputEnd) return;

          this.startDate = this.parseDate(inputStart.value);
          this.endDate = this.parseDate(inputEnd.value);

          if (!this.startDate || !this.endDate) {
                  alert('Silakan isi kedua tanggal');
                  return;
          }

          if (this.startDate > this.endDate) {
                  alert('Tanggal awal harus lebih kecil dari tanggal akhir');
                  return;
          }

          this.isActive = true;
          this.filterData();
          this.updateInfo();
          this.showFilteredResults();
    }

    /**
       * Filter data berdasarkan date range
          */
    filterData() {
          if (typeof DATA === 'undefined' || !Array.isArray(DATA)) return;

          // Simpan original data jika belum
          if (!this.originalData) {
                  this.originalData = [...DATA];
          }

          // Reset DATA ke original
          DATA.length = 0;
          DATA.push(...this.originalData);

          if (!this.isActive) return;

          // Filter DATA
          const filtered = DATA.filter(row => {
                  const tanggalStr = row.tanggal || row['Tanggal'];
                  if (!tanggalStr) return true;

                  const rowDate = this.extractDate(tanggalStr);
                  if (!rowDate) return true;

                  return rowDate >= this.startDate && rowDate <= this.endDate;
          });

          DATA.length = 0;
          DATA.push(...filtered);
    }

    /**
       * Update informasi range yang dipilih
          */
    updateInfo() {
          const inputStart = document.getElementById('dateRangeStart');
          const inputEnd = document.getElementById('dateRangeEnd');
          const infoEl = document.getElementById('dateRangeInfo');

          if (!infoEl) return;

          if (inputStart && inputStart.value && inputEnd && inputEnd.value) {
                  const startDate = new Date(inputStart.value);
                  const endDate = new Date(inputEnd.value);
                  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

                  infoEl.textContent = `Range: ${inputStart.value} hingga ${inputEnd.value} (${days} hari)`;
                  infoEl.style.display = 'block';
          } else {
                  infoEl.style.display = 'none';
          }
    }

    /**
       * Reset filter dan tampilkan semua data
          */
    resetFilter() {
          const inputStart = document.getElementById('dateRangeStart');
          const inputEnd = document.getElementById('dateRangeEnd');
          const infoEl = document.getElementById('dateRangeInfo');

          if (inputStart) inputStart.value = '';
          if (inputEnd) inputEnd.value = '';
          if (infoEl) infoEl.style.display = 'none';

          this.startDate = null;
          this.endDate = null;
          this.isActive = false;

          if (this.originalData) {
                  DATA.length = 0;
                  DATA.push(...this.originalData);
          }

          this.showFilteredResults();
    }

    /**
       * Tampilkan hasil filtered (refresh table)
          * Panggil fungsi yang sudah ada dari app.js
             */
    showFilteredResults() {
          // Panggil fungsi dari app.js yang me-render table
          if (typeof renderTable === 'function') {
                  renderTable();
          } else if (typeof updateTable === 'function') {
                  updateTable();
          } else if (typeof loadData === 'function') {
                  // Update stats jika ada
                  if (typeof updateStats === 'function') {
                            updateStats();
                  }
          }
    }

    /**
       * Set default date range (opsional)
          * Bisa digunakan untuk set range default saat halaman load
             */
    setDefaultRange(days = 7) {
          const inputEnd = document.getElementById('dateRangeEnd');
          const inputStart = document.getElementById('dateRangeStart');

          if (!inputEnd || !inputStart) return;

          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(endDate.getDate() - days);

          inputEnd.value = this.formatDateForInput(endDate);
          inputStart.value = this.formatDateForInput(startDate);
    }

    /**
       * Format date untuk input HTML (YYYY-MM-DD)
          */
    formatDateForInput(date) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
    }
}

// Initialize date range filter ketika DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
          const dateFilter = new DateRangeFilter();
          dateFilter.init();
    });
} else {
    const dateFilter = new DateRangeFilter();
    dateFilter.init();
}
