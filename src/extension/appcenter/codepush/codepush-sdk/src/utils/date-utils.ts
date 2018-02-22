// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { differenceInMinutes, format } from 'date-fns';

export function formatDate(unixOffset: number): string {
  let formattedDateString: string;
  const date = new Date(unixOffset);
  if (differenceInMinutes(Date.now(), date) < 2) {
    formattedDateString = 'Just now';
  } else {
    formattedDateString = format(date, 'MMM DD, hh:mm A');
  }
  return formattedDateString;
}