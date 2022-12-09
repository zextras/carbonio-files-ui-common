import { useMemo } from 'react';

export const UploadListContent = ({ ids }: { ids: string[] }): JSX.Element => {
	const items = useMemo(() => ids, [ids]);
	return <></>;
};
