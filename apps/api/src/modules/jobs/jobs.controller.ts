import {
  jobInputSchema,
  jobUpdateSchema,
  jobsExportQuerySchema,
  jobsQuerySchema,
  todayDateInput,
  type AdminJob,
  type DataResponse,
  type Paginated,
} from '@sch/shared';
import type { RequestHandler } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { parseIdParam } from '../../lib/admin-errors.js';
import { sendExport } from '../../lib/export.js';
import * as jobsService from './jobs.service.js';

export function createJobsAdminController(prisma: PrismaClient, now: () => number) {
  const parseId = (value: string | undefined) => parseIdParam(value, jobsService.jobNotFound);

  const list: RequestHandler = async (req, res) => {
    const body: Paginated<AdminJob> = await jobsService.listJobs(
      prisma,
      jobsQuerySchema.parse(req.query),
    );
    res.json(body);
  };

  const get: RequestHandler<{ id: string }> = async (req, res) => {
    const body: DataResponse<AdminJob> = {
      data: await jobsService.getJob(prisma, parseId(req.params.id)),
    };
    res.json(body);
  };

  const create: RequestHandler = async (req, res) => {
    const input = jobInputSchema.parse(req.body);
    const body: DataResponse<AdminJob> = {
      data: await jobsService.createJob(prisma, input, new Date(now())),
    };
    res.status(201).json(body);
  };

  const update: RequestHandler<{ id: string }> = async (req, res) => {
    const id = parseId(req.params.id);
    const patch = jobUpdateSchema.parse(req.body);
    const body: DataResponse<AdminJob> = {
      data: await jobsService.updateJob(prisma, id, patch, new Date(now())),
    };
    res.json(body);
  };

  const remove: RequestHandler<{ id: string }> = async (req, res) => {
    await jobsService.deleteJob(prisma, parseId(req.params.id));
    res.status(204).end();
  };

  const exportList: RequestHandler = async (req, res) => {
    const { format, ...filter } = jobsExportQuerySchema.parse(req.query);
    const date = new Date(now());
    const file = await jobsService.exportJobs(prisma, filter, format, date);
    sendExport(res, format, `trabajos-${todayDateInput(date)}`, file);
  };

  return { list, get, create, update, remove, exportList };
}
