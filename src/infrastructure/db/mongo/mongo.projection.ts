// Keeps Mongo-internal fields out of the domain objects returned by repositories.
export const HIDE_MONGO_INTERNAL_FIELDS = { _id: 0, __v: 0 } as const;
