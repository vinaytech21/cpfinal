# -*- coding: utf-8 -*-
# Generated by Django 1.9.2 on 2016-03-22 07:41
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0002_email_max_length'),
    ]

    operations = [
        migrations.AddField(
            model_name='emailaddress',
            name='name',
            field=models.CharField(blank=True, max_length=255, null=True, verbose_name='name'),
        ),
    ]