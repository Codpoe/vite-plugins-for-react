import { useParams } from 'react-router-dom';

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  return <div>user detail page: {id}</div>;
}
