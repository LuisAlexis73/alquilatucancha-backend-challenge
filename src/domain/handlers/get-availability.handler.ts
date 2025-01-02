import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  ClubWithAvailability,
  GetAvailabilityQuery,
} from '../commands/get-availaiblity.query';
import {
  ALQUILA_TU_CANCHA_CLIENT,
  AlquilaTuCanchaClient,
} from '../ports/aquila-tu-cancha.client';

@QueryHandler(GetAvailabilityQuery)
export class GetAvailabilityHandler
  implements IQueryHandler<GetAvailabilityQuery>
{
  constructor(
    @Inject(ALQUILA_TU_CANCHA_CLIENT)
    private alquilaTuCanchaClient: AlquilaTuCanchaClient,
  ) {}

  async execute(query: GetAvailabilityQuery): Promise<ClubWithAvailability[]> {
    // Obtener todos los clubes
    const clubs = await this.alquilaTuCanchaClient.getClubs(query.placeId);

    // Procesamos todos los clubes
    const clubsPromises = clubs.map(async (club) => {
      // Obtener las canchas para el club
      const courts = await this.alquilaTuCanchaClient.getCourts(club.id);

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
          available: slots,
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
    return await Promise.all(clubsPromises);
  }
}
