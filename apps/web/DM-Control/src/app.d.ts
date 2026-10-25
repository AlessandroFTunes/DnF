import type PocketBaseClient from 'pocketbase';
import type { User } from '@dnf/core/user';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			pb: PocketBaseClient;
			user?: User.Info;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
