import { FieldFunctionOptions, FieldPolicy } from '@apollo/client';
import { UploadItem } from '../../../types/common';
import { uploadVar } from '../../uploadVar';

export const getUploadItemFieldPolicy: FieldPolicy<
	unknown,
	unknown,
	UploadItem,
	FieldFunctionOptions<{ id?: string }, { id?: string }>
> = {
	read(_, options) {
		const id = options.args?.id;
		if (id) {
			return uploadVar()[id];
		}
		return undefined;
	}
};
