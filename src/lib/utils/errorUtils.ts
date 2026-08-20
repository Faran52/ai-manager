export const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return typeof error === 'string' && error.length > 0 ? error : 'Something went wrong';
};
