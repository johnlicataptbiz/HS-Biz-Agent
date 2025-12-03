class ModeService {
  private readonly KEY = 'HS_BIZ_DEMO_MODE';

  isDemoMode(): boolean {
    try {
      return localStorage.getItem(this.KEY) === '1';
    } catch {
      return false;
    }
  }

  setDemoMode(enabled: boolean) {
    try {
      if (enabled) localStorage.setItem(this.KEY, '1');
      else localStorage.removeItem(this.KEY);
    } catch {}
  }
}

export const modeService = new ModeService();

