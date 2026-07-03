import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import * as svc from './sales.service';
import { resolveUserScope, getClientList as fetchClientList } from '../call-master/call-master.service';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function parseDateRange(req: Request): { startDate: string; endDate: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 00:00`;
  const defaultEnd   = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 23:59`;
  return {
    startDate: (req.query.startDate as string) || defaultStart,
    endDate:   (req.query.endDate   as string) || defaultEnd,
  };
}

async function buildFilters(req: Request): Promise<svc.SalesFilters> {
  const { startDate, endDate } = parseDateRange(req);
  const scope = await resolveUserScope(req.user!.id, req.tenantId ?? null);

  let clientIds: number[] | undefined;
  if (req.query.clientId) {
    const requested = Number(req.query.clientId);
    clientIds = (scope.clientIds === null || scope.clientIds.includes(requested))
      ? [requested]
      : [];
  } else if (scope.clientIds !== null) {
    clientIds = scope.clientIds.length ? scope.clientIds : [-1];
  }

  const lob = (req.query.lob as string) || 'All';
  return { startDate, endDate, clientIds, lob };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export async function getKPIs(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getSalesKPIs(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('sales getKPIs error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sales KPIs' });
  }
}

export async function getTrend(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getSalesTrend(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('sales getTrend error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sales trend' });
  }
}

export async function getByLob(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getSalesByLob(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('sales getByLob error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sales by LOB' });
  }
}

export async function getPayment(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getPaymentBreakdown(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('sales getPayment error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch payment breakdown' });
  }
}

export async function getProducts(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const limit = Math.min(Number(req.query.limit) || 12, 50);
    const data = await svc.getTopProducts(filters, limit);
    res.json({ success: true, data });
  } catch (err) {
    console.error('sales getProducts error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch top products' });
  }
}

export async function getAgents(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getAgentLeaderboard(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('sales getAgents error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch agent leaderboard' });
  }
}

export async function getSubScenarios(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getSubScenarios(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('sales getSubScenarios error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sub-scenarios' });
  }
}

export async function getLobList(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getSalesLobList(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('sales getLobList error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch LOB list' });
  }
}

export async function getClients(req: Request, res: Response) {
  try {
    const data = await fetchClientList(req.tenantId ?? null, req.user!.id);
    res.json({ success: true, data });
  } catch (err) {
    console.error('sales getClients error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch client list' });
  }
}

export async function exportSales(req: Request, res: Response) {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const scope = await resolveUserScope(req.user!.id, req.tenantId ?? null);

    let clientIds: number[] | undefined;
    if (req.query.clientId) {
      const requested = Number(req.query.clientId);
      clientIds = (scope.clientIds === null || scope.clientIds.includes(requested))
        ? [requested]
        : [];
    } else if (scope.clientIds !== null) {
      clientIds = scope.clientIds.length ? scope.clientIds : [-1];
    }

    const lob = (req.query.lob as string) || 'All';
    const limit = Math.min(Number(req.query.limit) || 10000, 50000);
    const filters: svc.SalesFilters = { startDate, endDate, clientIds, lob };
    const rows = await svc.getSalesExport(filters, limit);
    res.json({ success: true, data: { rows, count: rows.length } });
  } catch (err) {
    console.error('sales exportSales error:', err);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPLOAD CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════════

const HEADER_MAP: Record<string, keyof svc.BellavitaRow> = {
  'week': 'week', 'date': 'saleDate', 'emp id': 'empId', 'emp_name': 'empName',
  'emp name': 'empName', 'tl': 'tl', 't1': 't1', 't2': 't2', 'fhd': 'fhd',
  'days': 'days', 'phone number': 'phoneNumber', 'phone_number': 'phoneNumber',
  'e-mail id': 'emailId', 'email id': 'emailId', 'email_id': 'emailId',
  'payment status': 'paymentStatus', 'payment_status': 'paymentStatus',
  'amount': 'amount', 'bella vita order id': 'orderId',
  'bella_vita_order_id': 'orderId', 'campaign': 'campaign',
  'calling status': 'callingStatus', 'calling_status': 'callingStatus',
  'discount code': 'discountCode', 'discount_code': 'discountCode',
  'count': 'count', 'current status': 'currentStatus',
  'current_status': 'currentStatus', 'final status': 'finalStatus',
  'final_status': 'finalStatus', 'order date&time': 'orderDatetime',
  'order_datetime': 'orderDatetime', 'state': 'state',
  'line item name': 'lineItemName', 'line_item_name': 'lineItemName',
  'pincode': 'pincode', 'order date': 'orderDate', 'order_date': 'orderDate',
  '24hrs&48hrs': 'hrs24_48', 'hrs 24-48': 'hrs24_48', '24hrs_48hrs': 'hrs24_48',
  'crazy deal': 'crazyDeal', 'crazy_deal': 'crazyDeal', 'perfume': 'perfume',
  'size': 'size', 'order pickup date&time': 'orderPickupDatetime',
  'order pickup date': 'orderPickupDatetime', 'order_pickup_datetime': 'orderPickupDatetime',
  'rto initiated date&time': 'rtoInitiatedDatetime', 'rto initiated date': 'rtoInitiatedDatetime',
  'rto_initiated_datetime': 'rtoInitiatedDatetime', 'diff hour': 'diffHour',
  'diff_hour': 'diffHour', 'lob': 'lob', 'pincode relevent': 'pincodeRelevent',
  'pincode_relevent': 'pincodeRelevent', 'rto status': 'rtoStatus',
  'rto_status': 'rtoStatus', 'draft order': 'draftOrder',
  'draft_order': 'draftOrder', '16:08': 'time1608', 'time 1608': 'time1608',
  'sale source name': 'saleSourceName', 'sale_source_name': 'saleSourceName',
  'shift': 'shift',
};

const GNC_HEADER_MAP: Record<string, keyof svc.GncRow> = {
  'week': 'week', 'date': 'saleDate', 'emp id': 'empId', 'emp_id': 'empId',
  'emp name': 'empName', 'emp_name': 'empName', 'tl': 'tl', 't1': 't1',
  't3': 't3', 'customer number': 'customerNumber', 'customer_number': 'customerNumber',
  'email id': 'emailId', 'email_id': 'emailId', 'payment status': 'paymentStatus',
  'payment_status': 'paymentStatus', 'gross amount': 'grossAmount',
  'gross_amount': 'grossAmount', 'sum before gst': 'sumBeforeGst',
  'sum_before_gst': 'sumBeforeGst', 'gnc order id': 'orderId',
  'gnc_order_id': 'orderId', 'campaign': 'campaign',
  'discount code': 'discountCode', 'discount_code': 'discountCode',
  'count': 'count', 'status': 'status', 'line item name': 'lineItemName',
  'line_item_name': 'lineItemName', 'sale lob': 'saleLob', 'sale_lob': 'saleLob',
  'target': 'target', 'sale source': 'saleSource', 'sale_source': 'saleSource',
};

// ─── Bellavita Sale Upload ────────────────────────────────────────────────────

export async function uploadBellavita(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { defval: '', header: 1 });
    const headerRow = rawRows[0] as string[];
    const dataRows = rawRows.slice(1).filter((r: any) => r.some((c: any) => c != null && String(c).trim() !== ''));
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });

    const colIndex: Record<string, number> = {};
    headerRow.forEach((h: string, i: number) => {
      const key = String(h).trim().toLowerCase();
      colIndex[key] = i;
    });

    const mapRow = (r: string[]): svc.BellavitaRow => {
      const get = (field: string) => {
        const idx = colIndex[field];
        return idx !== undefined ? String(r[idx] ?? '') : '';
      };
      return {
        week: get('week'), saleDate: get('date'), empId: get('emp id') || get('emp_id'),
        empName: get('emp name') || get('emp_name'), tl: get('tl'), t1: get('t1'), t2: get('t2'),
        fhd: get('fhd'), days: parseInt(get('days')) || 0, phoneNumber: get('phone number') || get('phone_number'),
        emailId: get('e-mail id') || get('email id') || get('email_id'),
        paymentStatus: get('payment status') || get('payment_status'),
        amount: parseFloat(get('amount')) || 0, orderId: get('bella vita order id') || get('bella_vita_order_id'),
        campaign: get('campaign'), callingStatus: get('calling status') || get('calling_status'),
        discountCode: get('discount code') || get('discount_code'), count: parseInt(get('count')) || 0,
        currentStatus: get('current status') || get('current_status'),
        finalStatus: get('final status') || get('final_status'),
        orderDatetime: get('order date&time') || get('order_datetime'), state: get('state'),
        lineItemName: get('line item name') || get('line_item_name'), pincode: get('pincode'),
        orderDate: get('order date') || get('order_date'),
        hrs24_48: get('24hrs&48hrs') || get('hrs 24-48') || get('24hrs_48hrs'),
        crazyDeal: get('crazy deal') || get('crazy_deal'), perfume: get('perfume'), size: get('size'),
        orderPickupDatetime: get('order pickup date&time') || get('order pickup date') || get('order_pickup_datetime'),
        rtoInitiatedDatetime: get('rto initiated date&time') || get('rto initiated date') || get('rto_initiated_datetime'),
        diffHour: parseInt(get('diff hour') || get('diff_hour')) || 0, lob: get('lob'),
        pincodeRelevent: get('pincode relevent') || get('pincode_relevent'),
        rtoStatus: get('rto status') || get('rto_status'), draftOrder: get('draft order') || get('draft_order'),
        time1608: get('16:08') || get('time 1608'), saleSourceName: get('sale source name') || get('sale_source_name'),
        shift: get('shift'),
      };
    };
    const mapped = dataRows.map(mapRow);
    const batchId = svc.generateBatchId();
    const inserted = await svc.uploadBellavitaSales(mapped, userId, batchId);
    await svc.logUpload(batchId, 'bb_sale', req.file.originalname, inserted, userId);
    res.json({ success: true, data: { rowsInserted: inserted, totalRows: mapped.length, batchId } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('sales uploadBellavita error:', msg);
    res.status(500).json({ success: false, message: `Upload failed: ${msg}` });
  }
}

// ─── GNC Sale Upload ──────────────────────────────────────────────────────────

export async function uploadGnc(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { defval: '', header: 1 });
    const headerRow = rawRows[0] as string[];
    const dataRows = rawRows.slice(1).filter((r: any) => r.some((c: any) => c != null && String(c).trim() !== ''));
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });

    const colIndex: Record<string, number> = {};
    headerRow.forEach((h: string, i: number) => { colIndex[String(h).trim().toLowerCase()] = i; });

    const mapRow = (r: string[]): svc.GncRow => {
      const get = (field: string) => { const idx = colIndex[field]; return idx !== undefined ? String(r[idx] ?? '') : ''; };
      return {
        week: get('week'), saleDate: get('date'), empId: get('emp id') || get('emp_id'),
        empName: get('emp name') || get('emp_name'), tl: get('tl'), t1: get('t1'), t3: get('t3'),
        customerNumber: get('customer number') || get('customer_number'),
        emailId: get('email id') || get('email_id'),
        paymentStatus: get('payment status') || get('payment_status'),
        grossAmount: parseFloat(get('gross amount') || get('gross_amount')) || 0,
        sumBeforeGst: parseFloat(get('sum before gst') || get('sum_before_gst')) || 0,
        orderId: get('gnc order id') || get('gnc_order_id'), campaign: get('campaign'),
        discountCode: get('discount code') || get('discount_code'),
        count: parseInt(get('count')) || 0, status: get('status'),
        lineItemName: get('line item name') || get('line_item_name'),
        saleLob: get('sale lob') || get('sale_lob'), target: parseInt(get('target')) || 0,
        saleSource: get('sale source') || get('sale_source'),
      };
    };
    const mapped = dataRows.map(mapRow);
    const batchId = svc.generateBatchId();
    const inserted = await svc.uploadGncSales(mapped, userId, batchId);
    await svc.logUpload(batchId, 'gnc_sale', req.file.originalname, inserted, userId);
    res.json({ success: true, data: { rowsInserted: inserted, totalRows: mapped.length, batchId } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('sales uploadGnc error:', msg);
    res.status(500).json({ success: false, message: `Upload failed: ${msg}` });
  }
}

// ─── GNC APR Upload ───────────────────────────────────────────────────────────

export async function uploadGncApr(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<(string | null)[]>(sheet, { header: 1, defval: null, blankrows: false });
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });
    const headerIdx = rawRows.findIndex(r => r.some(c => c != null && String(c).trim().toUpperCase() === 'UID'));
    if (headerIdx === -1) return res.status(400).json({ success: false, message: 'Could not find header row (expected "UID" column)' });
    const dataRows = rawRows.slice(headerIdx + 1);
    if (!dataRows.length) return res.status(400).json({ success: false, message: 'No data rows found' });
    const mapped: svc.GncAprRow[] = dataRows.map(r => ({
      uid: String(r[0] ?? ''), reportDate: String(r[1] ?? ''), userName: String(r[2] ?? ''),
      empId: String(r[3] ?? ''), tlName: String(r[4] ?? ''), calls: parseInt(String(r[5] ?? '0')) || 0,
      processType: String(r[6] ?? ''), loginTime: String(r[7] ?? ''), waitTime: String(r[8] ?? ''),
      talkTime: String(r[9] ?? ''), dispoTime: String(r[10] ?? ''), pauseTime: String(r[11] ?? ''),
      loginDuration: String(r[12] ?? ''), logoutTime: String(r[13] ?? ''), acht: parseFloat(String(r[14] ?? '0')) || 0,
      aoc: String(r[15] ?? ''), bio: String(r[16] ?? ''), bre: String(r[17] ?? ''),
      briefing: String(r[18] ?? ''), downTime: String(r[19] ?? ''), lunch: String(r[20] ?? ''),
      meet: String(r[21] ?? ''), qa: String(r[22] ?? ''), sb: String(r[23] ?? ''),
      teaBreak: String(r[24] ?? ''), trainingBreak: String(r[25] ?? ''), wash: String(r[26] ?? ''),
      netLogin: String(r[27] ?? ''), breakTime: String(r[28] ?? ''), traQa: String(r[29] ?? ''),
      downtime: String(r[30] ?? ''), atten: parseFloat(String(r[31] ?? '0')) || 0,
      capping: String(r[32] ?? ''),
    }));
    const batchId = svc.generateBatchId();
    const inserted = await svc.uploadGncApr(mapped, userId, batchId);
    await svc.logUpload(batchId, 'gnc_apr', req.file.originalname, inserted, userId);
    res.json({ success: true, data: { rowsInserted: inserted, totalRows: mapped.length, batchId } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('sales uploadGncApr error:', msg);
    res.status(500).json({ success: false, message: `Upload failed: ${msg}` });
  }
}

// ─── GNC Allocation Upload (array-based, duplicate "Date" cols) ──────────────

export async function uploadGncAllocation(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<(string | null)[]>(sheet, { header: 1, defval: null, blankrows: false });
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });
    const headerIdx = rawRows.findIndex(r => r.some(c => c != null && String(c).trim().toUpperCase() === 'UID'));
    if (headerIdx === -1) return res.status(400).json({ success: false, message: 'Could not find header row (expected "UID" column)' });
    const dataRows = rawRows.slice(headerIdx + 1);
    if (!dataRows.length) return res.status(400).json({ success: false, message: 'No data rows found' });
    const mapped: svc.GncAllocationRow[] = dataRows.map(r => ({
      uid: String(r[0] ?? ''), allocDate: String(r[1] ?? ''), helper: String(r[2] ?? ''),
      dateType: String(r[3] ?? ''), timeSlot: String(r[4] ?? ''), store: String(r[5] ?? ''),
      customerName: String(r[6] ?? ''), email: String(r[7] ?? ''),
      total: parseFloat(String(r[8] ?? '0')) || 0, createdAt: String(r[9] ?? ''),
      lineitemName: String(r[10] ?? ''), lineitemSku: String(r[11] ?? ''),
      shippingName: String(r[12] ?? ''), shippingStreet: String(r[13] ?? ''),
      shippingCity: String(r[14] ?? ''), shippingZip: String(r[15] ?? ''),
      shippingPhone: String(r[16] ?? ''), empId: String(r[17] ?? ''),
      callingStatus: String(r[18] ?? ''), subScenarios1: String(r[19] ?? ''),
      callbackDate: String(r[20] ?? ''), sameDayConnect: String(r[21] ?? ''),
      ncConnect: String(r[22] ?? ''),
    }));
    const batchId = svc.generateBatchId();
    const inserted = await svc.uploadGncAllocation(mapped, userId, batchId);
    await svc.logUpload(batchId, 'gnc_allocation', req.file.originalname, inserted, userId);
    res.json({ success: true, data: { rowsInserted: inserted, totalRows: mapped.length, batchId } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('sales uploadGncAllocation error:', msg);
    res.status(500).json({ success: false, message: `Upload failed: ${msg}` });
  }
}

// ─── Bellavita APR Upload (array-based, duplicate "Attendance" cols) ────────

export async function uploadBellavitaApr(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<(string | null)[]>(sheet, { header: 1, defval: null, blankrows: false });
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });
    const headerIdx = rawRows.findIndex(r => r.some(c => c != null && String(c).trim().toUpperCase() === 'UID'));
    if (headerIdx === -1) return res.status(400).json({ success: false, message: 'Could not find header row (expected "UID" column)' });
    const dataRows = rawRows.slice(headerIdx + 1);
    if (!dataRows.length) return res.status(400).json({ success: false, message: 'No data rows found' });
    const mapped: svc.BellavitaAprRow[] = dataRows.map(r => ({
      uid: String(r[0] ?? ''), week: String(r[1] ?? ''), saleDate: String(r[2] ?? ''),
      did: String(r[3] ?? ''), campaign: String(r[4] ?? ''), tl: String(r[5] ?? ''),
      empId: String(r[6] ?? ''), empName: String(r[7] ?? ''), loginTime: String(r[8] ?? ''),
      totalDuration: String(r[9] ?? ''), totalCallTime: String(r[10] ?? ''),
      totalPause: String(r[11] ?? ''), totalIdleTime: String(r[12] ?? ''),
      totalBreakTime: String(r[13] ?? ''), routingTime: String(r[14] ?? ''),
      afterCallWork: String(r[15] ?? ''), loginDuration: String(r[16] ?? ''),
      utilization: String(r[17] ?? ''), totalBreaks: String(r[18] ?? ''),
      billable: String(r[19] ?? ''), lunchDuration: String(r[20] ?? ''),
      meetingDuration: String(r[21] ?? ''), trainingDuration: String(r[22] ?? ''),
      totalACW: String(r[23] ?? ''), totalHoldTime: String(r[24] ?? ''),
      totalMuteDuration: String(r[25] ?? ''), totalConferenceTime: String(r[26] ?? ''),
      totalConsultTime: String(r[27] ?? ''), avgSpeedOfAnswer: String(r[28] ?? ''),
      auxTime: String(r[29] ?? ''), totalOnlineTime: String(r[30] ?? ''),
      mtd: String(r[31] ?? ''), teamLeader: String(r[32] ?? ''), fhd: String(r[33] ?? ''),
      tenure: parseInt(String(r[34] ?? '0')) || 0, tenurityWeek: String(r[35] ?? ''),
      subLob: String(r[36] ?? ''), uniqueCount: parseInt(String(r[37] ?? '0')) || 0,
      attendance2: String(r[38] ?? ''), capping: String(r[39] ?? ''),
      attendance3: String(r[40] ?? ''),
    }));
    const batchId = svc.generateBatchId();
    const inserted = await svc.uploadBellavitaApr(mapped, userId, batchId);
    await svc.logUpload(batchId, 'bb_apr', req.file.originalname, inserted, userId);
    res.json({ success: true, data: { rowsInserted: inserted, totalRows: mapped.length, batchId } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('sales uploadBellavitaApr error:', msg);
    res.status(500).json({ success: false, message: `Upload failed: ${msg}` });
  }
}

// ─── Bellavita Chat Upload (array-based, duplicate "Email"/"FRT" cols) ──────

export async function uploadBellavitaChat(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<(string | null)[]>(sheet, { header: 1, defval: null, blankrows: false });
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });
    const headerIdx = rawRows.findIndex(r => r.some(c => c != null && String(c).trim().toUpperCase() === 'TICKET ID'));
    if (headerIdx === -1) return res.status(400).json({ success: false, message: 'Could not find header row (expected "Ticket ID" column)' });
    const dataRows = rawRows.slice(headerIdx + 1);
    if (!dataRows.length) return res.status(400).json({ success: false, message: 'No data rows found' });
    const mapped: svc.BellavitaChatRow[] = dataRows.map(r => ({
      ticketId: String(r[0] ?? ''), inboxId: String(r[1] ?? ''), inboxName: String(r[2] ?? ''),
      ticketStatus: String(r[3] ?? ''), agentName: String(r[4] ?? ''), email1: String(r[5] ?? ''),
      phoneNumber: String(r[6] ?? ''), createdAt: String(r[7] ?? ''), assignedAt: String(r[8] ?? ''),
      agentFrtAt: String(r[9] ?? ''), frt1: String(r[10] ?? ''), resolutionTimeAt: String(r[11] ?? ''),
      resolutionTime: String(r[12] ?? ''), averageWaitTime: String(r[13] ?? ''),
      isResolved: String(r[14] ?? ''), isOutsideWorkingHrs: String(r[15] ?? ''),
      level1Tags: String(r[16] ?? ''), level2Tags: String(r[17] ?? ''), level3Tags: String(r[18] ?? ''),
      systemTags: String(r[19] ?? ''), chatLink: String(r[20] ?? ''), repeatStatus: String(r[21] ?? ''),
      repeatStatusOnAssign: String(r[22] ?? ''), time1406: String(r[23] ?? ''),
      resolutionTimeMin: String(r[24] ?? ''), frtTat: String(r[25] ?? ''), resolutionTat: String(r[26] ?? ''),
      phoneNumber1: String(r[27] ?? ''), currentAgent: String(r[28] ?? ''), email2: String(r[29] ?? ''),
      chatDate: String(r[30] ?? ''), empId: String(r[31] ?? ''), lob: String(r[32] ?? ''),
      week: String(r[33] ?? ''), count1: parseFloat(String(r[34] ?? '0')) || 0,
      timeSlot: String(r[35] ?? ''), hour: parseInt(String(r[36] ?? '0')) || 0,
      tlName: String(r[37] ?? ''), disposition: String(r[38] ?? ''),
      dayShiftNightShift: String(r[39] ?? ''), uniqueId: String(r[40] ?? ''),
      froud: String(r[41] ?? ''), frt2: String(r[42] ?? ''), userType: String(r[43] ?? ''),
    }));
    const batchId = svc.generateBatchId();
    const inserted = await svc.uploadBellavitaChat(mapped, userId, batchId);
    await svc.logUpload(batchId, 'bb_chat', req.file.originalname, inserted, userId);
    res.json({ success: true, data: { rowsInserted: inserted, totalRows: mapped.length, batchId } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('sales uploadBellavitaChat error:', msg);
    res.status(500).json({ success: false, message: `Upload failed: ${msg}` });
  }
}

// ─── Bellavita Cart Upload (array-based, positional columns) ─────────────────

export async function uploadBellavitaCart(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<(string | null)[]>(sheet, { header: 1, defval: null, blankrows: false });
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });
    const headerIdx = rawRows.findIndex(r => r.some(c => c != null && String(c).trim().toUpperCase() === 'CC'));
    if (headerIdx === -1) return res.status(400).json({ success: false, message: 'Could not find header row (expected "CC" column)' });
    const dataRows = rawRows.slice(headerIdx + 1);
    if (!dataRows.length) return res.status(400).json({ success: false, message: 'No data rows found' });
    const mapped: svc.BellavitaCartRow[] = dataRows.map(r => ({
      cc: String(r[0] ?? ''), source: String(r[1] ?? ''), sno: parseInt(String(r[2] ?? '0')) || 0,
      cartId: String(r[3] ?? ''), createdAt: String(r[4] ?? ''), updatedAt: String(r[5] ?? ''),
      customerName: String(r[6] ?? ''), customerAddress: String(r[7] ?? ''),
      phoneNumber: String(r[8] ?? ''), emailId: String(r[9] ?? ''),
      lineItems: String(r[10] ?? ''), variantTitle: String(r[11] ?? ''),
      abandonedCartLink: String(r[12] ?? ''), amount: parseFloat(String(r[13] ?? '0')) || 0,
      phone10Digit: String(r[14] ?? ''), dates: String(r[15] ?? ''), agent: String(r[16] ?? ''),
      disposition: String(r[17] ?? ''), subDisposition: String(r[18] ?? ''),
      callDate: String(r[19] ?? ''), sameDayConnect: String(r[20] ?? ''), status: String(r[21] ?? ''),
    }));
    const batchId = svc.generateBatchId();
    const inserted = await svc.uploadBellavitaCart(mapped, userId, batchId);
    await svc.logUpload(batchId, 'bb_cart', req.file.originalname, inserted, userId);
    res.json({ success: true, data: { rowsInserted: inserted, totalRows: mapped.length, batchId } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('sales uploadBellavitaCart error:', msg);
    res.status(500).json({ success: false, message: `Upload failed: ${msg}` });
  }
}

// ─── Upload Log Controllers ─────────────────────────────────────────────────

export async function getUploadLogs(req: Request, res: Response) {
  try {
    const tableName = req.query.table as string | undefined;
    const logs = await svc.getUploadLogs(tableName);
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error('getUploadLogs error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch upload logs' });
  }
}

export async function deleteUploadLog(req: Request, res: Response) {
  try {
    const { batchId } = req.params;
    const tableName = req.query.table as string;
    if (!tableName) return res.status(400).json({ success: false, message: 'table query param required' });
    const result = await svc.deleteUploadBatch(batchId, tableName);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('deleteUploadLog error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete upload' });
  }
}
