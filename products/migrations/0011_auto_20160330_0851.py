# -*- coding: utf-8 -*-
# Generated by Django 1.9.2 on 2016-03-30 08:51
from __future__ import unicode_literals

import datetime
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0010_auto_20160322_0741'),
    ]

    operations = [
        migrations.AlterField(
            model_name='product',
            name='date_created',
            field=models.DateTimeField(default=datetime.datetime(2016, 4, 29, 8, 51, 43, 742343)),
        ),
    ]
