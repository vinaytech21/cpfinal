# -*- coding: utf-8 -*-
# Generated by Django 1.9.2 on 2016-02-28 04:11
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='zipcode',
            field=models.CharField(blank=True, max_length=200, null=True, verbose_name='Zip Code'),
        ),
    ]
