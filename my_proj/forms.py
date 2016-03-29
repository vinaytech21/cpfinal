from django import forms
 #from registration.forms import RegistrationForm
from django import forms

 
class ContactForm(forms.Form):
	name = forms.CharField(required=False)
	email = forms.EmailField()
	message = forms.CharField(
        widget=forms.Textarea(attrs={'rows': '5', 'cols':'25'}))
