import type { Point } from "geojson";

export type PointWCrs = Point & {
  crs: {
    type: "name";
    properties: {
      name: string;
    };
  };
};
