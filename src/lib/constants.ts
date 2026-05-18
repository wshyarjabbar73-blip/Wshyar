import { createClient } from '@supabase/supabase-js';

export const SB_URL = 'https://vxdlqtqtllodlbrvprnf.supabase.co';
export const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4ZGxxdHF0bGxvZGxicnZwcm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODAwMjUsImV4cCI6MjA5NDQ1NjAyNX0.Z69bheEZYrZJcEyq7cNHzHNYdwP7ue1yTkAzw-UaThk';

export const supabase = createClient(SB_URL, SB_KEY);

export const words3 = ['باخ','بان','باز','باڵ','بۆر','پار','پاک','پەل','تەم','تاج','تاڵ','تۆپ','تیر','چاڵ','چاک','چۆن','خاڵ','خەم','دار','دەم','دوو','ڕەش','ڕۆژ','زار','زەم','زۆر','زین','ساڵ','سام','سپی','سور','شاخ','شین','شێر','قاز','کار','کاڵ','کێو','گاز','گۆڵ','لار','مار','مێش','ناو','هار','یار','ئاو','پیر','تەق','چێژ','خۆر','داو','ژان','ژین','سەر','شەو','کات','گەش','مەڕ','هات','یەک','ئاش','بێڵ','تەڕ','گێل','خاو','خول','ڕان','ساز','شاد','گول','لاو','ماچ','ژیر','ساف','قاپ','لێو','چۆک','ڕۆن','شەم','گۆڕ','مەر','کچ','فیل','گەل','هێز','زێڕ','ڕێز'];
export const words8 = ['پێشکەوتن','کارگێڕیی','ئامادەیی','بەردەوام','شارەوانی','پەیوەندی','زانیاریی','کۆنفرانس','پەروەردە','پیشەسازی','بەڕێوبەر','کۆبونەوە','دامەزران','کۆمپانیا','دەزگاکان','خوێندکار'];

export function toKu(n: number | string): string {
  return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
}

export const MAX_ATTEMPTS = 6;
