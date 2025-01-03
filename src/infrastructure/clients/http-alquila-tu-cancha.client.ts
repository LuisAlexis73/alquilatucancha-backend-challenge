import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import * as moment from 'moment';

import { Club } from '../../domain/model/club';
import { Court } from '../../domain/model/court';
import { Slot } from '../../domain/model/slot';
import { AlquilaTuCanchaClient } from '../../domain/ports/aquila-tu-cancha.client';

interface ErrorResponse {
  message: string;
  statusCode: number;
}

interface SlotValidationParams {
  clubId: number;
  courtId: number;
  date: Date;
}

@Injectable()
export class HTTPAlquilaTuCanchaClient implements AlquilaTuCanchaClient {
  private readonly base_url: string;
  private readonly logger = new Logger(HTTPAlquilaTuCanchaClient.name);
  private readonly defaultTimeOut = 5000;

  constructor(private httpService: HttpService, config: ConfigService) {
    this.base_url = config.get<string>('ATC_BASE_URL', 'http://localhost:4000');

    this.httpService.axiosRef.defaults.timeout = this.defaultTimeOut;
    this.httpService.axiosRef.defaults.baseURL = this.base_url;
  }

  async getClubs(placeId: string): Promise<Club[]> {
    if (!placeId?.trim()) {
      throw new BadRequestException('PlaceId is required');
    }

    return this.makeRequest<Club[]>('/clubs', { placeId });
  }

  async getCourts(clubId: number): Promise<Court[]> {
    if (!clubId || clubId <= 0) {
      throw new BadRequestException('ClubId must be greater than 0');
    }

    return this.makeRequest<Court[]>(`/clubs/${clubId}/courts`);
  }

  async getAvailableSlots(
    clubId: number,
    courtId: number,
    date: Date,
  ): Promise<Slot[]> {
    this.validateSlotParams({ clubId, courtId, date });

    return this.makeRequest<Slot[]>(
      `/clubs/${clubId}/courts/${courtId}/slots`,
      { date: moment(date).format('YYYY-MM-DD') },
    );
  }

  private handleError(error: AxiosError<ErrorResponse>) {
    const messageError = error.response?.data.message || error.message;
    const statusCode = error.response?.status;

    this.logger.error(`API Error: ${messageError}`, error.stack);

    if (!error.response) {
      throw new ServiceUnavailableException('Service Unavailable');
    }

    switch (statusCode) {
      case 400:
        throw new BadRequestException(messageError);
      case 404:
        throw new BadRequestException('Resource not found');
      case 500:
        throw new ServiceUnavailableException('Internal Server Error');
      default:
        throw new ServiceUnavailableException('Unexpected error occurred');
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, any> = {},
  ): Promise<T> {
    try {
      const { data } = await this.httpService.axiosRef.get<T>(endpoint, {
        params,
      });
      return data;
    } catch (error) {
      this.handleError(error as AxiosError<ErrorResponse>);
      throw error;
    }
  }

  private validateSlotParams({ clubId, courtId, date }: SlotValidationParams) {
    const validations = [
      {
        condition: !clubId || clubId <= 0,
        message: 'ClubId must be greater than 0',
      },
      {
        condition: !courtId || courtId <= 0,
        message: 'CourtId must be greater than 0',
      },
      {
        condition: !date || !(date instanceof Date) || isNaN(date.getTime()),
        message: 'Date must be a valid date',
      },
    ];

    const failValidation = validations.find((valid) => valid.condition);
    if (failValidation) {
      throw new BadRequestException(failValidation.message);
    }
  }
}
