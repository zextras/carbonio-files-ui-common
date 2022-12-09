import { FieldFunctionOptions, FieldPolicy } from '@apollo/client';
import { UploadItem } from '../../../types/common';
import { uploadVar } from '../../uploadVar';
import filter from 'lodash/filter';

export const getUploadItemsFieldPolicy: FieldPolicy<
	unknown,
	unknown,
	UploadItem[],
	FieldFunctionOptions<{ parentId: string | null }, { parentId: string | null }>
> = {
	read(_, options) {
		const parentId = options.args?.parentId;
		if (parentId !== undefined) {
			return filter(uploadVar(), (uploadItem) => uploadItem.parentId === parentId);
		}
		return Object.values(uploadVar());
	}
};
