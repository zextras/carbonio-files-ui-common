import { FieldPolicy } from '@apollo/client';
import { UploadItem } from '../../../types/common';
import { uploadVar } from '../../uploadVar';

export const getUploadItemsFieldPolicy: FieldPolicy<unknown, unknown, UploadItem[]> = {
	read() {
		return Object.values(uploadVar());
	}
};
