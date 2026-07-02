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

// ─── Column mapping for CSV/Excel headers → BellavitaRow fields ───────────

const HEADER_MAP: Record<string, keyof svc.BellavitaRow> = {
  'week': 'week',
  'date': 'saleDate',
  'emp id': 'empId',
  'emp_name': 'empName',
  'emp name': 'empName',
  'tl': 'tl',
  't1': 't1',
  't2': 't2',
  'fhd': 'fhd',
  'days': 'days',
  'phone number': 'phoneNumber',
  'phone_number': 'phoneNumber',
  'e-mail id': 'emailId',
  'email id': 'emailId',
  'email_id': 'emailId',
  'payment status': 'paymentStatus',
  'payment_status': 'paymentStatus',
  'amount': 'amount',
  'bella vita order id': 'orderId',
  'bella_vita_order_id': 'orderId',
  'campaign': 'campaign',
  'calling status': 'callingStatus',
  'calling_status': 'callingStatus',
  'discount code': 'discountCode',
  'discount_code': 'discountCode',
  'count': 'count',
  'current status': 'currentStatus',
  'current_status': 'currentStatus',
  'final status': 'finalStatus',
  'final_status': 'finalStatus',
  'order date&time': 'orderDatetime',
  'order_datetime': 'orderDatetime',
  'state': 'state',
  'line item name': 'lineItemName',
  'line_item_name': 'lineItemName',
  'pincode': 'pincode',
  'order date': 'orderDate',
  'order_date': 'orderDate',
  '24hrs&48hrs': 'hrs24_48',
  'hrs 24-48': 'hrs24_48',
  '24hrs_48hrs': 'hrs24_48',
  'crazy deal': 'crazyDeal',
  'crazy_deal': 'crazyDeal',
  'perfume': 'perfume',
  'size': 'size',
  'order pickup date&time': 'orderPickupDatetime',
  'order pickup date': 'orderPickupDatetime',
  'order_pickup_datetime': 'orderPickupDatetime',
  'rto initiated date&time': 'rtoInitiatedDatetime',
  'rto initiated date': 'rtoInitiatedDatetime',
  'rto_initiated_datetime': 'rtoInitiatedDatetime',
  'diff hour': 'diffHour',
  'diff_hour': 'diffHour',
  'lob': 'lob',
  'pincode relevent': 'pincodeRelevent',
  'pincode_relevent': 'pincodeRelevent',
  'rto status': 'rtoStatus',
  'rto_status': 'rtoStatus',
  'draft order': 'draftOrder',
  'draft_order': 'draftOrder',
  '16:08': 'time1608',
  'time 1608': 'time1608',
  'sale source name': 'saleSourceName',
  'sale_source_name': 'saleSourceName',
  'shift': 'shift',
};

// ─── Column mapping for GNC CSV/Excel headers → GncRow fields ──────────────

const GNC_HEADER_MAP: Record<string, keyof svc.GncRow> = {
  'week': 'week',
  'date': 'saleDate',
  'emp id': 'empId',
  'emp_id': 'empId',
  'emp_name': 'empName',
  'emp name': 'empName',
  'tl': 'tl',
  't1': 't1',
  't3': 't3',
  'customernumber': 'customerNumber',
  'customer number': 'customerNumber',
  'customer_number': 'customerNumber',
  'e-mail id': 'emailId',
  'email id': 'emailId',
  'email_id': 'emailId',
  'payment status': 'paymentStatus',
  'payment_status': 'paymentStatus',
  'gross amount': 'grossAmount',
  'gross_amount': 'grossAmount',
  'sum before gst': 'sumBeforeGst',
  'sum_before_gst': 'sumBeforeGst',
  'orderid': 'orderId',
  'order id': 'orderId',
  'campaign': 'campaign',
  'discount code': 'discountCode',
  'discount_code': 'discountCode',
  'count': 'count',
  'status': 'status',
  'lineitem name': 'lineItemName',
  'lineitem_name': 'lineItemName',
  'line item name': 'lineItemName',
  'line_item_name': 'lineItemName',
  'sale lob': 'saleLob',
  'sale_lob': 'saleLob',
  'target': 'target',
  'sale source': 'saleSource',
  'sale_source': 'saleSource',
};

export async function uploadBellavita(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

    if (rawRows.length === 0) {
      return res.status(400).json({ success: false, message: 'File is empty' });
    }

    // Normalize headers: lowercase, trim; convert values to strings
    const mapped = rawRows.map(raw => {
      const row: Partial<svc.BellavitaRow> = {};
      for (const [header, value] of Object.entries(raw)) {
        const key = header.trim().toLowerCase();
        const field = HEADER_MAP[key];
        if (field) {
          (row as Record<string, unknown>)[field] = value == null ? '' : String(value);
        }
      }
      return row as svc.BellavitaRow;
    });

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    const batchId = svc.generateBatchId();
    const inserted = await svc.uploadBellavitaSales(mapped, userId, batchId);
    await svc.logUpload(batchId, 'bb_sale', req.file.originalname, inserted, userId);
    res.json({ success: true, data: { rowsInserted: inserted, totalRows: mapped.length, batchId } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('sales uploadBellavita error:', msg);
    if (err instanceof Error && err.stack) console.error(err.stack);
    res.status(500).json({ success: false, message: `Upload failed: ${msg}` });
  }
}

export async function uploadGnc(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

    if (rawRows.length === 0) {
      return res.status(400).json({ success: false, message: 'File is empty' });
    }

    const mapped = rawRows.map(raw => {
      const row: Partial<svc.GncRow> = {};
      for (const [header, value] of Object.entries(raw)) {
        const key = header.trim().toLowerCase();
        const field = GNC_HEADER_MAP[key];
        if (field) {
          (row as Record<string, unknown>)[field] = value == null ? '' : String(value);
        }
      }
      return row as svc.GncRow;
    });

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    const batchId = svc.generateBatchId();
    const inserted = await svc.uploadGncSales(mapped, userId, batchId);
    await svc.logUpload(batchId, 'gnc_sale', req.file.originalname, inserted, userId);
    res.json({ success: true, data: { rowsInserted: inserted, totalRows: mapped.length, batchId } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('sales uploadGnc error:', msg);
    if (err instanceof Error && err.stack) console.error(err.stack);
    res.status(500).json({ success: false, message: `Upload failed: ${msg}` });
  }
}

// ─── Column mapping for GNC APR headers → GncAprRow fields ──────────────────

const GNC_APR_HEADER_MAP: Record<string, keyof svc.GncAprRow> = {
  'uid': 'uid',
  'date': 'reportDate',
  'user': 'userName',
  'id': 'empId',
  'tl name': 'tlName',
  'tl_name': 'tlName',
  'calls': 'calls',
  'process type': 'processType',
  'process_type': 'processType',
  'login time': 'loginTime',
  'login_time': 'loginTime',
  'wait': 'waitTime',
  'talk': 'talkTime',
  'dispo': 'dispoTime',
  'pause': 'pauseTime',
  'login': 'loginDuration',
  'logout': 'logoutTime',
  'acht': 'acht',
  'aoc': 'aoc',
  'bio': 'bio',
  'bre': 'bre',
  'briefing': 'briefing',
  'down': 'downTime',
  'lunch': 'lunch',
  'meet': 'meet',
  'qa': 'qa',
  'sb': 'sb',
  'tea break': 'teaBreak',
  'tea_break': 'teaBreak',
  'training break': 'trainingBreak',
  'training_break': 'trainingBreak',
  'wash': 'wash',
  'net login': 'netLogin',
  'net_login': 'netLogin',
  'break': 'breakTime',
  'tra+qa': 'traQa',
  'tra_qa': 'traQa',
  'downtime': 'downtime',
  'atten': 'atten',
  'capping': 'capping',
};

export async function uploadGncApr(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

    if (rawRows.length === 0) {
      return res.status(400).json({ success: false, message: 'File is empty' });
    }

    const mapped = rawRows.map(raw => {
      const row: Partial<svc.GncAprRow> = {};
      for (const [header, value] of Object.entries(raw)) {
        const key = header.trim().toLowerCase();
        const field = GNC_APR_HEADER_MAP[key];
        if (field) {
          (row as Record<string, unknown>)[field] = value == null ? '' : String(value);
        }
      }
      return row as svc.GncAprRow;
    });

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    const batchId = svc.generateBatchId();
    const inserted = await svc.uploadGncApr(mapped, userId, batchId);
    await svc.logUpload(batchId, 'gnc_apr', req.file.originalname, inserted, userId);
    res.json({ success: true, data: { rowsInserted: inserted, totalRows: mapped.length, batchId } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('sales uploadGncApr error:', msg);
    if (err instanceof Error && err.stack) console.error(err.stack);
    res.status(500).json({ success: false, message: `Upload failed: ${msg}` });
  }
}

// ─── GNC Allocation Upload (uses array indexing because of duplicate "Date" cols) ──

export async function uploadGncAllocation(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<(string | null)[]>(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Find header row (first row containing "UID")
    const headerIdx = rawRows.findIndex(r =>
      r.some(c => c != null && String(c).trim().toUpperCase() === 'UID')
    );
    if (headerIdx === -1) {
      return res.status(400).json({ success: false, message: 'Could not find header row (expected "UID" column)' });
    }

    const dataRows = rawRows.slice(headerIdx + 1);
    if (dataRows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data rows found' });
    }

    const mapped: svc.GncAllocationRow[] = dataRows.map(r => ({
      uid:            String(r[0] ?? ''),
      allocDate:      String(r[1] ?? ''),
      helper:         String(r[2] ?? ''),
      dateType:       String(r[3] ?? ''),
      timeSlot:       String(r[4] ?? ''),
      store:          String(r[5] ?? ''),
      customerName:   String(r[6] ?? ''),
      email:          String(r[7] ?? ''),
      total:          parseFloat(String(r[8] ?? '0')) || 0,
      createdAt:      String(r[9] ?? ''),
      lineitemName:   String(r[10] ?? ''),
      lineitemSku:    String(r[11] ?? ''),
      shippingName:   String(r[12] ?? ''),
      shippingStreet: String(r[13] ?? ''),
      shippingCity:   String(r[14] ?? ''),
      shippingZip:    String(r[15] ?? ''),
      shippingPhone:  String(r[16] ?? ''),
      empId:          String(r[17] ?? ''),
      callingStatus:  String(r[18] ?? ''),
      subScenarios1:  String(r[19] ?? ''),
      callbackDate:   String(r[20] ?? ''),
      sameDayConnect: String(r[21] ?? ''),
      ncConnect:      String(r[22] ?? ''),
    }));

    const batchId = svc.generateBatchId();
    const inserted = await svc.uploadGncAllocation(mapped, userId, batchId);
    await svc.logUpload(batchId, 'gnc_allocation', req.file.originalname, inserted, userId);
    res.json({ success: true, data: { rowsInserted: inserted, totalRows: mapped.length, batchId } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('sales uploadGncAllocation error:', msg);
    if (err instanceof Error && err.stack) console.error(err.stack);
    res.status(500).json({ success: false, message: `Upload failed: ${msg}` });
  }
}

// ─── Bellavita APR Upload (array-based, duplicate "Attendance" columns) ────

export async function uploadBellavitaApr(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<(string | null)[]>(sheet, {
      header: 1, defval: null, blankrows: false,
    });

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const headerIdx = rawRows.findIndex(r =>
      r.some(c => c != null && String(c).trim().toUpperCase() === 'UNIQUE ID')
    );
    if (headerIdx === -1) {
      return res.status(400).json({ success: false, message: 'Could not find header row (expected "Unique ID" column)' });
    }

    const dataRows = rawRows.slice(headerIdx + 1);
    if (dataRows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data rows found' });
    }

    const mapped: svc.BellavitaAprRow[] = dataRows.map(r => ({
      uniqueId:       String(r[0] ?? ''),
      week:           String(r[1] ?? ''),
      reportDate:     String(r[2] ?? ''),
      empName:        String(r[3] ?? ''),
      noiid:          String(r[4] ?? ''),
      numCallsChat:   parseInt(String(r[5] ?? '0')) || 0,
      lob:            String(r[6] ?? ''),
      loginTime:      String(r[7] ?? ''),
      waitTime:       String(r[8] ?? ''),
      talkTime:       String(r[9] ?? ''),
      dispoTime:      String(r[10] ?? ''),
      pauseTime:      String(r[11] ?? ''),
      acht:           parseInt(String(r[12] ?? '0')) || 0,
      lunch:          String(r[13] ?? ''),
      tea:            String(r[14] ?? ''),
      tea1:           String(r[15] ?? ''),
      washr:          String(r[16] ?? ''),
      teamBriefingAux: String(r[17] ?? ''),
      netPause:       String(r[18] ?? ''),
      avgDispo:       String(r[19] ?? ''),
      totalBreak:     String(r[20] ?? ''),
      actualLoginHrs: String(r[21] ?? ''),
      downtime:       String(r[22] ?? ''),
      loginDuration:  String(r[23] ?? ''),
      logoutTime:     String(r[24] ?? ''),
      netLoginHrs:    String(r[25] ?? ''),
      utilization:    String(r[26] ?? ''),
      attendance1:    String(r[27] ?? ''),
      week1:          String(r[28] ?? ''),
      mtd:            String(r[29] ?? ''),
      teamLeader:     String(r[30] ?? ''),
      fhd:            String(r[31] ?? ''),
      tenure:         parseInt(String(r[32] ?? '0')) || 0,
      tenurityWeek:   String(r[33] ?? ''),
      subLob:         String(r[34] ?? ''),
      uniqueCount:    parseInt(String(r[35] ?? '0')) || 0,
      attendance2:    String(r[36] ?? ''),
      capping:        String(r[37] ?? ''),
      attendance3:    String(r[38] ?? ''),
    }));

    const batchId = svc.generateBatchId();
    const inserted = await svc.uploadBellavitaApr(mapped, userId, batchId);
    await svc.logUpload(batchId, 'bb_apr', req.file.originalname, inserted, userId);
    res.json({ success: true, data: { rowsInserted: inserted, totalRows: mapped.length, batchId } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('sales uploadBellavitaApr error:', msg);
    if (err instanceof Error && err.stack) console.error(err.stack);
    res.status(500).json({ success: false, message: `Upload failed: ${msg}` });
  }
}

// ─── Bellavita Chat Upload (array-based, duplicate "Email", "FRT" cols) ────

export async function uploadBellavitaChat(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<(string | null)[]>(sheet, {
      header: 1, defval: null, blankrows: false,
    });

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const headerIdx = rawRows.findIndex(r =>
      r.some(c => c != null && String(c).trim().toUpperCase() === 'TICKET ID')
    );
    if (headerIdx === -1) {
      return res.status(400).json({ success: false, message: 'Could not find header row (expected "Ticket ID" column)' });
    }

    const dataRows = rawRows.slice(headerIdx + 1);
    if (dataRows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data rows found' });
    }

    const mapped: svc.BellavitaChatRow[] = dataRows.map(r => ({
      ticketId:           String(r[0] ?? ''),
      inboxId:            String(r[1] ?? ''),
      inboxName:          String(r[2] ?? ''),
      ticketStatus:       String(r[3] ?? ''),
      agentName:          String(r[4] ?? ''),
      email1:             String(r[5] ?? ''),
      phoneNumber:        String(r[6] ?? ''),
      createdAt:          String(r[7] ?? ''),
      assignedAt:         String(r[8] ?? ''),
      agentFrtAt:         String(r[9] ?? ''),
      frt1:               String(r[10] ?? ''),
      resolutionTimeAt:   String(r[11] ?? ''),
      resolutionTime:     String(r[12] ?? ''),
      averageWaitTime:    String(r[13] ?? ''),
      isResolved:         String(r[14] ?? ''),
      isOutsideWorkingHrs: String(r[15] ?? ''),
      level1Tags:         String(r[16] ?? ''),
      level2Tags:         String(r[17] ?? ''),
      level3Tags:         String(r[18] ?? ''),
      systemTags:         String(r[19] ?? ''),
      chatLink:           String(r[20] ?? ''),
      repeatStatus:       String(r[21] ?? ''),
      repeatStatusOnAssign: String(r[22] ?? ''),
      time1406:           String(r[23] ?? ''),
      resolutionTimeMin:  String(r[24] ?? ''),
      frtTat:             String(r[25] ?? ''),
      resolutionTat:      String(r[26] ?? ''),
      phoneNumber1:       String(r[27] ?? ''),
      currentAgent:       String(r[28] ?? ''),
      email2:             String(r[29] ?? ''),
      chatDate:           String(r[30] ?? ''),
      empId:              String(r[31] ?? ''),
      lob:                String(r[32] ?? ''),
      week:               String(r[33] ?? ''),
      count1:             parseFloat(String(r[34] ?? '0')) || 0,
      timeSlot:           String(r[35] ?? ''),
      hour:               parseInt(String(r[36] ?? '0')) || 0,
      tlName:             String(r[37] ?? ''),
      disposition:        String(r[38] ?? ''),
      dayShiftNightShift: String(r[39] ?? ''),
      uniqueId:           String(r[40] ?? ''),
      froud:              String(r[41] ?? ''),
      frt2:               String(r[42] ?? ''),
      userType:           String(r[43] ?? ''),
    }));

    const batchId = svc.generateBatchId();
    const inserted = await svc.uploadBellavitaChat(mapped, userId, batchId);
    await svc.logUpload(batchId, 'bb_chat', req.file.originalname, inserted, userId);
    res.json({ success: true, data: { rowsInserted: inserted, totalRows: mapped.length, batchId } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('sales uploadBellavitaChat error:', msg);
    if (err instanceof Error && err.stack) console.error(err.stack);
    res.status(500).json({ success: false, message: `Upload failed: ${msg}` });
  }
}

// ─── Bellavita Cart Upload (array-based, positional columns) ─────────────────

export async function uploadBellavitaCart(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<(string | null)[]>(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Find header row (first row containing "CC")
    const headerIdx = rawRows.findIndex(r =>
      r.some(c => c != null && String(c).trim().toUpperCase() === 'CC')
    );
    if (headerIdx === -1) {
      return res.status(400).json({ success: false, message: 'Could not find header row (expected "CC" column)' });
    }

    const dataRows = rawRows.slice(headerIdx + 1);
    if (dataRows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data rows found' });
    }

    const mapped: svc.BellavitaCartRow[] = dataRows.map(r => ({
      cc:                String(r[0] ?? ''),
      source:            String(r[1] ?? ''),
      sno:               parseInt(String(r[2] ?? '0')) || 0,
      cartId:            String(r[3] ?? ''),
      createdAt:         String(r[4] ?? ''),
      updatedAt:         String(r[5] ?? ''),
      customerName:      String(r[6] ?? ''),
      customerAddress:   String(r[7] ?? ''),
      phoneNumber:       String(r[8] ?? ''),
      emailId:           String(r[9] ?? ''),
      lineItems:         String(r[10] ?? ''),
      variantTitle:      String(r[11] ?? ''),
      abandonedCartLink: String(r[12] ?? ''),
      amount:            parseFloat(String(r[13] ?? '0')) || 0,
      phone10Digit:      String(r[14] ?? ''),
      dates:             String(r[15] ?? ''),
      agent:             String(r[16] ?? ''),
      disposition:       String(r[17] ?? ''),
      subDisposition:    String(r[18] ?? ''),
      callDate:          String(r[19] ?? ''),
      sameDayConnect:    String(r[20] ?? ''),
      status:            String(r[21] ?? ''),
    }));

    const batchId = svc.generateBatchId();
    const inserted = await svc.uploadBellavitaCart(mapped, userId, batchId);
    await svc.logUpload(batchId, 'bb_cart', req.file.originalname, inserted, userId);
    res.json({ success: true, data: { rowsInserted: inserted, totalRows: mapped.length, batchId } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('sales uploadBellavitaCart error:', msg);
    if (err instanceof Error && err.stack) console.error(err.stack);
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
    if (!tableName) {
      return res.status(400).json({ success: false, message: 'table query param required' });
    }
    const result = await svc.deleteUploadBatch(batchId, tableName);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('deleteUploadLog error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete upload' });
  }
}
