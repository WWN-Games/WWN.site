/* ============================================================================
   WWN — image service: по умолчанию AVIF (исходники уже AVIF).
   WebP по умолчанию только раздувал вес; SVG не перекодируется.
   Явно указанный format у компонентов по-прежнему уважается.
   ============================================================================ */

import sharpService from "astro/assets/services/sharp";

type ValidateOptions = NonNullable<typeof sharpService.validateOptions>;

export default {
  ...sharpService,
  validateOptions: (async (options, imageConfig, logger) => {
    const explicit = options.format;
    const validated = await sharpService.validateOptions?.(options, imageConfig, logger);
    if (!validated) return options;
    if (!explicit && validated.format !== "svg") validated.format = "avif";
    return validated;
  }) satisfies ValidateOptions,
};
