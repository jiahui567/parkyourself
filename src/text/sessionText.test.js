import {
  feeText,
  googleMapsUrl,
  levelBayText,
  routeBackText,
  shareMessage,
  spotLocation,
  spotText,
  walkingDirectionsUrl,
  zoneSinceText,
} from './sessionText';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur).
const at = (localDateTime) => new Date(localDateTime).getTime();

const FULL = {
  level: 'B2',
  bay: 'C14',
  zone_colour_name: 'Blue',
  access_type: 'escalator',
  landmark: 'Starbucks',
  started_at: at('2026-10-23T14:15'),
  lat: null,
  lng: null,
};

describe('spotText', () => {
  it('joins level, bay and zone colour', () => {
    expect(spotText(FULL)).toBe('B2 C14 Blue');
  });

  it('skips what was not recorded', () => {
    expect(spotText({ level: 'B2' })).toBe('B2');
  });
});

describe('levelBayText', () => {
  it('joins level and bay with a dot', () => {
    expect(levelBayText(FULL)).toBe('B2 · C14');
  });

  it('shows whichever one was recorded', () => {
    expect(levelBayText({ bay: 'C14' })).toBe('C14');
  });

  it('is null when neither was recorded', () => {
    expect(levelBayText({ level: '', bay: null })).toBeNull();
  });
});

describe('zoneSinceText', () => {
  it('gives the zone colour and the local start time', () => {
    expect(zoneSinceText(FULL)).toBe('Blue zone · Since 2:15 PM');
  });

  it('leaves out the zone when none was picked', () => {
    expect(zoneSinceText({ ...FULL, zone_colour_name: null })).toBe('Since 2:15 PM');
  });
});

describe('routeBackText', () => {
  it('builds the route from PLAN.md', () => {
    expect(routeBackText(FULL)).toBe('Find Starbucks → take the escalator beside it → B2 → blue zone, pillar C14');
  });

  it('starts with a capital when there is no landmark', () => {
    expect(routeBackText({ access_type: 'lift', level: 'P3', bay: '25' })).toBe('Take the lift → P3 → pillar 25');
  });

  it('leaves out an access type of other', () => {
    expect(routeBackText({ access_type: 'other', landmark: 'Uniqlo', level: 'L2' })).toBe('Find Uniqlo → L2');
  });

  it('shows the zone without a bay', () => {
    expect(routeBackText({ level: 'B1', zone_colour_name: 'Green' })).toBe('B1 → green zone');
  });

  it('returns null when nothing was recorded', () => {
    expect(routeBackText({})).toBeNull();
  });
});

describe('feeText', () => {
  it('formats an exact fee', () => {
    expect(feeText({ feeSen: 300, isEstimate: false })).toBe('RM 3.00');
  });

  it('labels an estimate', () => {
    expect(feeText({ feeSen: 3400, isEstimate: true })).toBe('RM 34.00 (estimate)');
  });

  it('returns null without a fee', () => {
    expect(feeText(null)).toBeNull();
    expect(feeText({ feeSen: null })).toBeNull();
  });
});

describe('shareMessage', () => {
  it('builds the message from PLAN.md', () => {
    const message = shareMessage({
      vehicleName: 'My Myvi',
      placeName: 'Pavilion Bukit Jalil',
      session: { ...FULL, lat: 3.0512, lng: 101.6789 },
    });

    expect(message).toBe(
      [
        'My Myvi is parked at Pavilion Bukit Jalil',
        'Level B2, bay C14, blue zone',
        'Took the escalator, first shop: Starbucks',
        'Parked at 2:15 PM',
        'Map: https://www.google.com/maps/search/?api=1&query=3.0512,101.6789',
      ].join('\n')
    );
  });

  it('leaves out lines with nothing to say', () => {
    const message = shareMessage({ vehicleName: 'My Myvi', session: { started_at: at('2026-10-23T09:05') } });

    expect(message).toBe('My Myvi is parked\nParked at 9:05 AM');
  });

  it('writes the first shop on its own line when no access type was chosen', () => {
    const message = shareMessage({
      vehicleName: 'My Myvi',
      session: { landmark: 'Starbucks', started_at: at('2026-10-23T09:05') },
    });

    expect(message).toBe('My Myvi is parked\nFirst shop: Starbucks\nParked at 9:05 AM');
  });
});

describe('googleMapsUrl', () => {
  it('builds a Google Maps search link', () => {
    expect(googleMapsUrl(3.0512, 101.6789)).toBe('https://www.google.com/maps/search/?api=1&query=3.0512,101.6789');
  });
});

describe('walkingDirectionsUrl', () => {
  it('builds a Google Maps walking directions link', () => {
    expect(walkingDirectionsUrl({ lat: 3.0512, lng: 101.6789 })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=3.0512,101.6789&travelmode=walking'
    );
  });
});

describe('spotLocation', () => {
  it.each([
    {
      rule: 'the location saved when parking comes first',
      session: { lat: 3.0512, lng: 101.6789, place_lat: 3.1279, place_lng: 101.7238 },
      location: { lat: 3.0512, lng: 101.6789 },
    },
    {
      rule: "the place's location stands in for none",
      session: { lat: null, lng: null, place_lat: 3.1279, place_lng: 101.7238 },
      location: { lat: 3.1279, lng: 101.7238 },
    },
    { rule: 'neither gives null', session: { lat: null, lng: null, place_lat: null, place_lng: null }, location: null },
  ])('$rule', ({ session, location }) => {
    expect(spotLocation(session)).toEqual(location);
  });
});
