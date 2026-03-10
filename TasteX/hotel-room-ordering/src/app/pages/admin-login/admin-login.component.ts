import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.scss'
})
export class AdminLoginComponent {
  username = signal('admin');
  password = signal('admin123');
  showPassword = signal(false);
  error = signal('');

  constructor(private readonly router: Router) {}

  signIn(): void {
    const user = this.username().trim();
    const pass = this.password().trim();

    if (user === 'admin' && pass === 'admin123') {
      this.error.set('');
      this.router.navigate(['/admin/dashboard']);
      return;
    }

    this.error.set('Invalid credentials. Use admin / admin123');
  }

  togglePassword(): void {
    this.showPassword.update((current) => !current);
  }
}
