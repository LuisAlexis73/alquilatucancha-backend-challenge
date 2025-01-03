import { HttpException } from '@nestjs/common';
import * as moment from 'moment';

import { AlquilaTuCanchaClient } from '../../domain/ports/aquila-tu-cancha.client';
import { GetAvailabilityQuery } from '../commands/get-availaiblity.query';
import { Club } from '../model/club';
import { Court } from '../model/court';
import { Slot } from '../model/slot';
import { GetAvailabilityHandler } from './get-availability.handler';

describe('GetAvailabilityHandler', () => {
  let handler: GetAvailabilityHandler;
  let client: FakeAlquilaTuCanchaClient;

  beforeEach(() => {
    client = new FakeAlquilaTuCanchaClient();
    handler = new GetAvailabilityHandler(client);
  });

  it('returns the availability', async () => {
    client.clubs = {
      '123': [{ id: 1 }],
    };
    client.courts = {
      '1': [{ id: 1 }],
    };
    client.slots = {
      '1_1_2022-12-05': [],
    };
    const placeId = '123';
    const date = moment('2022-12-05').toDate();

    const response = await handler.execute(
      new GetAvailabilityQuery(placeId, date),
    );

    expect(response).toEqual([{ id: 1, courts: [{ id: 1, available: [] }] }]);
  });

  it('throws NOT_FOUND when placeId does not exist', async () => {
    client.clubs = {};
    const placeId = '99999999';
    const date = moment('2022-12-05').toDate();

    await expect(
      handler.execute(new GetAvailabilityQuery(placeId, date)),
    ).rejects.toThrow(HttpException);

    try {
      await handler.execute(new GetAvailabilityQuery(placeId, date));
    } catch (error) {
      if (error instanceof HttpException) {
        expect(error.getStatus()).toBe(404);
        expect(error.message).toBe(`No clubs found for placeId: ${placeId}`);
      }
    }
  });

  it('throws BAD_REQUEST when date is invalid', async () => {
    const placeId = '123';
    const invalidDate = new Date('invalid-date');

    await expect(
      handler.execute(new GetAvailabilityQuery(placeId, invalidDate)),
    ).rejects.toThrow(HttpException);

    try {
      await handler.execute(new GetAvailabilityQuery(placeId, invalidDate));
    } catch (error) {
      if (error instanceof HttpException) {
        expect(error.getStatus()).toBe(400);
        expect(error.message).toBe('Invalid date format');
      }
    }
  });

  it('throws NOT_FOUND when club has no available courts', async () => {
    client.clubs = {
      '123': [{ id: 1 }],
    };
    client.courts = {
      '1': [],
    };

    const placeId = '123';
    const date = moment('2022-12-05').toDate();

    await expect(
      handler.execute(new GetAvailabilityQuery(placeId, date)),
    ).rejects.toThrow(HttpException);

    try {
      await handler.execute(new GetAvailabilityQuery(placeId, date));
    } catch (error) {
      if (error instanceof HttpException) {
        expect(error.getStatus()).toBe(404);
        expect(error.message).toBe(
          'No available courts found for the specified date',
        );
      }
    }
  });
});

class FakeAlquilaTuCanchaClient implements AlquilaTuCanchaClient {
  clubs: Record<string, Club[]> = {};
  courts: Record<string, Court[]> = {};
  slots: Record<string, Slot[]> = {};
  async getClubs(placeId: string): Promise<Club[]> {
    return this.clubs[placeId];
  }
  async getCourts(clubId: number): Promise<Court[]> {
    return this.courts[String(clubId)];
  }
  async getAvailableSlots(
    clubId: number,
    courtId: number,
    date: Date,
  ): Promise<Slot[]> {
    return this.slots[
      `${clubId}_${courtId}_${moment(date).format('YYYY-MM-DD')}`
    ];
  }
}
