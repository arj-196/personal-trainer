import { loginAction } from '../../actions';

export async function POST(request: Request) {
  const formData = await request.formData();
  await loginAction(formData);
}
