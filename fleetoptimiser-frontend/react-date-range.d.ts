declare module 'react-date-range' {
  export const DateRange: any;

  export type Range = {
    startDate: Date;
    endDate: Date;
    key: string;
  };

  export type RangeKeyDict = {
    [key: string]: Range;
  };
}