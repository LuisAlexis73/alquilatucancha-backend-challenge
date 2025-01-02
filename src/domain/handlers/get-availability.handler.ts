import { HttpException, HttpStatus, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  ClubWithAvailability,
  GetAvailabilityQuery,
} from '../commands/get-availaiblity.query';
import {
  ALQUILA_TU_CANCHA_CLIENT,
  AlquilaTuCanchaClient,
} from '../ports/aquila-tu-cancha.client';
import * as moment from 'moment';

@QueryHandler(GetAvailabilityQuery)
export class GetAvailabilityHandler
  implements IQueryHandler<GetAvailabilityQuery>
{
  constructor(
    @Inject(ALQUILA_TU_CANCHA_CLIENT)
    private alquilaTuCanchaClient: AlquilaTuCanchaClient,
  ) {}

  async execute(query: GetAvailabilityQuery): Promise<ClubWithAvailability[]> {
    if (!query.placeId || query.placeId.trim().length === 0) {
      throw new HttpException('PlaceId is required', HttpStatus.BAD_REQUEST);
    }

    if (!query.date || !moment(query.date).isValid()) {
      throw new HttpException('Invalid date format', HttpStatus.BAD_REQUEST);
    }

    // Obtener todos los clubes
    const clubs = await this.alquilaTuCanchaClient.getClubs(query.placeId);
    if (!clubs || clubs.length === 0) {
      throw new HttpException(
        `No clubs found for placeId: ${query.placeId}`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Procesamos todos los clubes
    const clubsPromises = clubs.map(async (club) => {
      // Obtener las canchas para el club
      const courts = await this.alquilaTuCanchaClient.getCourts(club.id);
      if (!courts || courts.length === 0) {
        return null;
      }

      // Procesamos todas las canchas de este club
      const courtsPromises = courts.map(async (court) => {
        // Obtener los slots para la cancha
        const slots = await this.alquilaTuCanchaClient.getAvailableSlots(
          club.id,
          court.id,
          query.date,
        );

        return {
          ...court,
          available: slots || [],
        };
      });

      // Esperamos que se resulevan las promesas
      const courtsWithAvailability = await Promise.all(courtsPromises);

      return {
        ...club,
        courts: courtsWithAvailability,
      };
    });

    // Esperamos que se resulevan las promesas de clubes
    const results = (await Promise.all(clubsPromises)).filter(
      (club): club is ClubWithAvailability => club !== null,
    );
    if (results.length === 0) {
      throw new HttpException(
        'No available courts found for the specified date',
        HttpStatus.NOT_FOUND,
      );
    }

    return results;
  }
}
