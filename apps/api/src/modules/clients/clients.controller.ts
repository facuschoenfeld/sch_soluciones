import {
  clientInputSchema,
  clientUpdateSchema,
  clientsExportQuerySchema,
  clientsQuerySchema,
  todayDateInput,
  type AdminClientDetail,
  type AdminClientSummary,
  type DataResponse,
  type Paginated,
} from '@sch/shared';
import type { RequestHandler } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { parseIdParam } from '../../lib/admin-errors.js';
import { sendExport } from '../../lib/export.js';
import * as clientsService from './clients.service.js';

export function createClientsAdminController(prisma: PrismaClient, now: () => number) {
  const parseId = (value: string | undefined) => parseIdParam(value, clientsService.clientNotFound);

  const list: RequestHandler = async (req, res) => {
    const body: Paginated<AdminClientSummary> = await clientsService.listClients(
      prisma,
      clientsQuerySchema.parse(req.query),
    );
    res.json(body);
  };

  const get: RequestHandler<{ id: string }> = async (req, res) => {
    const body: DataResponse<AdminClientDetail> = {
      data: await clientsService.getClient(prisma, parseId(req.params.id)),
    };
    res.json(body);
  };

  const create: RequestHandler = async (req, res) => {
    const body: DataResponse<AdminClientDetail> = {
      data: await clientsService.createClient(prisma, clientInputSchema.parse(req.body)),
    };
    res.status(201).json(body);
  };

  const update: RequestHandler<{ id: string }> = async (req, res) => {
    const id = parseId(req.params.id);
    const patch = clientUpdateSchema.parse(req.body);
    const body: DataResponse<AdminClientDetail> = {
      data: await clientsService.updateClient(prisma, id, patch),
    };
    res.json(body);
  };

  const remove: RequestHandler<{ id: string }> = async (req, res) => {
    await clientsService.deleteClient(prisma, parseId(req.params.id));
    res.status(204).end();
  };

  const exportList: RequestHandler = async (req, res) => {
    const { format, ...filter } = clientsExportQuerySchema.parse(req.query);
    const date = new Date(now());
    const file = await clientsService.exportClients(prisma, filter, format, date);
    sendExport(res, format, `clientes-${todayDateInput(date)}`, file);
  };

  return { list, get, create, update, remove, exportList };
}
